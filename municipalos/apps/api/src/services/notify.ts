import { and, eq, inArray, notifications, staffMemberships, withTenant, type Tx } from "@municipalos/database";
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
    .where(and(eq(staffMemberships.departmentId, departmentId), eq(staffMemberships.status, "active")));
  return rows.map((r) => r.userId);
}

/**
 * Sends queued emails after the transaction that created them has committed. Delivery failures
 * are recorded on the notification and logged; they never fail the originating request.
 */
export async function deliverQueuedEmails(deps: AppDeps, municipalityId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const queued = await withTenant(deps.db, { municipalityId }, (tx) =>
    tx.select().from(notifications).where(and(inArray(notifications.id, ids), eq(notifications.status, "queued"))),
  );
  for (const n of queued) {
    let status: "sent" | "failed" = "sent";
    try {
      await deps.email.send({ to: n.recipientEmail!, subject: n.subject, text: n.body });
    } catch (err) {
      status = "failed";
      console.error(`[notifications] email delivery failed for notification ${n.id}:`, err);
    }
    await withTenant(deps.db, { municipalityId }, (tx) =>
      tx
        .update(notifications)
        .set({ status, sentAt: status === "sent" ? new Date() : null })
        .where(eq(notifications.id, n.id)),
    );
  }
}
