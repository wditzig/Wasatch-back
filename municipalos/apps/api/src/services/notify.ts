import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  lte,
  municipalities,
  notifications,
  or,
  staffMemberships,
  withTenant,
  type Tx,
} from "@municipalos/database";
import { residentUpdateEmail } from "@municipalos/notifications";
import type { AppDeps, Municipality } from "../context";

/** Queues an email to the resident who reported a request, if they left an address. */
export async function queueResidentEmail(
  tx: Tx,
  deps: AppDeps,
  municipality: Municipality,
  request: { id: string; reference: string; reporterEmail: string | null },
  categoryName: string,
  headline: string,
  message?: string | null,
): Promise<string[]> {
  if (!request.reporterEmail) return [];
  const email = residentUpdateEmail({
    municipalityName: municipality.name,
    reference: request.reference,
    categoryName,
    headline,
    message,
    trackingUrl: `${deps.config.publicSiteUrl}/${municipality.slug}/requests/${request.reference}`,
  });
  const [row] = await tx
    .insert(notifications)
    .values({
      municipalityId: municipality.id,
      channel: "email",
      recipientEmail: request.reporterEmail,
      subject: email.subject,
      body: email.text,
      entityType: "service_request",
      entityId: request.id,
    })
    .returning({ id: notifications.id });
  return row ? [row.id] : [];
}

export async function notifyStaffUsers(
  tx: Tx,
  municipalityId: string,
  userIds: string[],
  subject: string,
  body: string,
  requestId: string,
): Promise<void> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  await tx.insert(notifications).values(
    unique.map((recipientUserId) => ({
      municipalityId,
      channel: "in_app" as const,
      recipientUserId,
      subject,
      body,
      entityType: "service_request",
      entityId: requestId,
      status: "sent" as const,
      sentAt: new Date(),
    })),
  );
}

export async function departmentStaffUserIds(tx: Tx, departmentId: string): Promise<string[]> {
  const rows = await tx
    .select({ userId: staffMemberships.userId })
    .from(staffMemberships)
    .where(
      and(eq(staffMemberships.departmentId, departmentId), eq(staffMemberships.status, "active")),
    );
  return rows.map((r) => r.userId);
}

export const MAX_EMAIL_ATTEMPTS = 6;

/** Delay before retry n (1-based): 1, 5, 25 minutes, then 2 hours, capped at 6 hours. */
export function retryDelayMs(attempts: number): number {
  const minutes = [1, 5, 25, 120, 360][Math.min(attempts, 5) - 1] ?? 360;
  return minutes * 60_000;
}

/**
 * Claims due queued emails for one municipality and tries to deliver them.
 *
 * Rows are locked with SKIP LOCKED, so several workers (or the immediate post-commit attempt
 * and the background worker) never send the same message twice. A failed send is retried with
 * backoff and finally marked `failed`; it never fails the request that queued it.
 */
export async function deliverDueEmails(
  deps: AppDeps,
  municipalityId: string,
  options: { ids?: string[]; limit?: number } = {},
): Promise<{ sent: number; retrying: number; failed: number }> {
  const result = { sent: 0, retrying: 0, failed: 0 };
  if (options.ids && options.ids.length === 0) return result;
  await withTenant(deps.db, { municipalityId }, async (tx) => {
    const now = new Date();
    const due = await tx
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.channel, "email"),
          eq(notifications.status, "queued"),
          or(isNull(notifications.nextAttemptAt), lte(notifications.nextAttemptAt, now)),
          options.ids ? inArray(notifications.id, options.ids) : undefined,
        ),
      )
      .orderBy(asc(notifications.createdAt))
      .limit(options.limit ?? 25)
      .for("update", { skipLocked: true });

    for (const n of due) {
      const attempts = n.attempts + 1;
      try {
        await deps.email.send({ to: n.recipientEmail!, subject: n.subject, text: n.body });
        await tx
          .update(notifications)
          .set({
            status: "sent",
            sentAt: new Date(),
            attempts,
            nextAttemptAt: null,
            lastError: null,
          })
          .where(eq(notifications.id, n.id));
        result.sent += 1;
      } catch (err) {
        const exhausted = attempts >= MAX_EMAIL_ATTEMPTS;
        const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
        console.error(`[notifications] email ${n.id} attempt ${attempts} failed: ${message}`);
        await tx
          .update(notifications)
          .set({
            status: exhausted ? "failed" : "queued",
            attempts,
            nextAttemptAt: exhausted ? null : new Date(Date.now() + retryDelayMs(attempts)),
            lastError: message,
          })
          .where(eq(notifications.id, n.id));
        if (exhausted) result.failed += 1;
        else result.retrying += 1;
      }
    }
  });
  return result;
}

/** First delivery attempt, right after the transaction that queued the emails has committed. */
export async function deliverQueuedEmails(
  deps: AppDeps,
  municipalityId: string,
  ids: string[],
): Promise<void> {
  try {
    await deliverDueEmails(deps, municipalityId, { ids });
  } catch (err) {
    // The emails stay queued; the outbox worker will pick them up.
    console.error("[notifications] immediate delivery attempt failed", err);
  }
}

/** One pass of the outbox worker across every active municipality. */
export async function processOutbox(
  deps: AppDeps,
): Promise<{ sent: number; retrying: number; failed: number }> {
  const total = { sent: 0, retrying: 0, failed: 0 };
  const tenants = await deps.db.select({ id: municipalities.id }).from(municipalities);
  for (const tenant of tenants) {
    const r = await deliverDueEmails(deps, tenant.id);
    total.sent += r.sent;
    total.retrying += r.retrying;
    total.failed += r.failed;
  }
  return total;
}

/** Runs the outbox worker on an interval. Returns a function that stops it. */
export function startOutboxWorker(deps: AppDeps, intervalMs = 30_000): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    processOutbox(deps)
      .catch((err) => console.error("[notifications] outbox pass failed", err))
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
