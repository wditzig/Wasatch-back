/**
 * Website CMS: pages, revisions, the review workflow and announcements.
 *
 * Publishing rules live here and in `contentWorkflow`:
 *  - content only becomes public through an explicit action by someone holding
 *    `content.publish` — nothing publishes itself, and no automated system can publish;
 *  - the public site serves, per page, the published revision with the latest effective time
 *    that is not in the future (so scheduled revisions take over on their own);
 *  - revisions are never deleted or rewritten once they leave draft.
 */
import {
  alias,
  and,
  announcements,
  asc,
  contentRevisions as revisions,
  desc,
  eq,
  inArray,
  moduleEntitlements,
  notifications,
  rolePermissions,
  sql,
  staffMemberships,
  users,
  websitePages as pages,
  withTenant,
  type Tx,
} from "@municipalos/database";
import {
  contentBlocksSchema,
  type ContentBlock,
  type SaveDraftInput,
} from "@municipalos/validation";
import {
  checkTransition,
  contentWorkflow,
  type ContentRevisionStatus,
  type ContentWorkflowPermission,
} from "@municipalos/workflows";
import type { AppDeps, Municipality, StaffContext } from "../context";
import { conflict, forbidden, notFound, unprocessable } from "../errors";
import { recordAudit } from "../lib/audit";

export interface RequestMeta {
  ip: string;
  requestId: string;
}

type RevisionRow = typeof revisions.$inferSelect;
export type RevisionDisplayStatus =
  "draft" | "in_review" | "live" | "scheduled" | "superseded" | "archived";

const iso = (d: Date) => d.toISOString();
const isoOrNull = (d: Date | null) => (d ? d.toISOString() : null);
const effectiveTime = (r: RevisionRow): Date => r.publishAt ?? r.publishedAt ?? r.updatedAt;
const effectiveSql = sql`coalesce(${revisions.publishAt}, ${revisions.publishedAt})`;
const permissions = (staff: StaffContext) =>
  staff.permissions as ReadonlySet<ContentWorkflowPermission>;

function parseBlocks(value: unknown): ContentBlock[] {
  const parsed = contentBlocksSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

function isUniqueViolation(err: unknown, constraint: string): boolean {
  const e = ((err as { cause?: unknown })?.cause ?? err) as {
    code?: string;
    constraint_name?: string;
  };
  return e?.code === "23505" && e.constraint_name === constraint;
}

/** Splits a page's revisions into the roles they currently play. */
function classify(all: RevisionRow[], now: Date) {
  const published = all.filter((r) => r.status === "published");
  const live =
    published
      .filter((r) => effectiveTime(r) <= now)
      .sort((a, b) => effectiveTime(b).getTime() - effectiveTime(a).getTime())[0] ?? null;
  const scheduled = published
    .filter((r) => effectiveTime(r) > now)
    .sort((a, b) => effectiveTime(a).getTime() - effectiveTime(b).getTime());
  const working = all.find((r) => r.status === "draft" || r.status === "in_review") ?? null;
  const archived = all
    .filter((r) => r.status === "archived")
    .sort((a, b) => b.revisionNumber - a.revisionNumber);
  const display = (r: RevisionRow): RevisionDisplayStatus => {
    if (r.status !== "published") return r.status;
    if (live && r.id === live.id) return "live";
    return effectiveTime(r) > now ? "scheduled" : "superseded";
  };
  return { live, scheduled, working, archived, display };
}

async function loadPage(tx: Tx, id: string) {
  const [page] = await tx.select().from(pages).where(eq(pages.id, id));
  if (!page) throw notFound("Page");
  return page;
}

const loadRevisions = (tx: Tx, pageId: string) =>
  tx
    .select()
    .from(revisions)
    .where(eq(revisions.pageId, pageId))
    .orderBy(desc(revisions.revisionNumber));

async function nextRevisionNumber(tx: Tx, pageId: string): Promise<number> {
  const [row] = await tx
    .select({ max: sql<number>`coalesce(max(${revisions.revisionNumber}), 0)::int` })
    .from(revisions)
    .where(eq(revisions.pageId, pageId));
  return (row?.max ?? 0) + 1;
}

async function notify(
  tx: Tx,
  municipalityId: string,
  userIds: string[],
  subject: string,
  body: string,
  pageId: string,
) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  await tx.insert(notifications).values(
    unique.map((recipientUserId) => ({
      municipalityId,
      channel: "in_app" as const,
      recipientUserId,
      subject,
      body,
      entityType: "website_page",
      entityId: pageId,
      status: "sent" as const,
      sentAt: new Date(),
    })),
  );
}

/** Active staff of the current municipality whose role can publish content. */
async function publisherUserIds(tx: Tx, exceptUserId: string): Promise<string[]> {
  const rows = await tx
    .select({ userId: staffMemberships.userId })
    .from(staffMemberships)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, staffMemberships.roleId))
    .where(
      and(eq(staffMemberships.status, "active"), eq(rolePermissions.permission, "content.publish")),
    );
  return rows.map((r) => r.userId).filter((id) => id !== exceptUserId);
}

function transitionOrThrow(
  staff: StaffContext,
  from: ContentRevisionStatus,
  to: ContentRevisionStatus,
  note?: string,
) {
  const check = checkTransition(contentWorkflow, {
    from,
    to,
    permissions: permissions(staff),
    note,
  });
  if (check.ok) return;
  if (check.reason === "forbidden") throw forbidden();
  if (check.reason === "note_required")
    throw unprocessable("note_required", "Explain what needs to change.");
  throw unprocessable(
    "invalid_transition",
    "That action is not available for this page right now.",
  );
}

/* ───────────────────────────── Staff: pages ───────────────────────────── */

export async function listPages(deps: AppDeps, staff: StaffContext, userId: string) {
  return withTenant(deps.db, { municipalityId: staff.municipality.id, userId }, async (tx) => {
    const rows = await tx.select().from(pages).orderBy(asc(pages.title));
    const all = await tx.select().from(revisions);
    const now = new Date();
    return rows.map((page) => {
      const c = classify(
        all.filter((r) => r.pageId === page.id),
        now,
      );
      return {
        id: page.id,
        slug: page.slug,
        title: page.title,
        showInNav: page.showInNav,
        navOrder: page.navOrder,
        isLive: c.live !== null,
        scheduledFor: c.scheduled[0] ? iso(effectiveTime(c.scheduled[0])) : null,
        workingStatus: (c.working?.status ?? null) as "draft" | "in_review" | null,
        isArchived:
          c.live === null &&
          c.scheduled.length === 0 &&
          c.working === null &&
          c.archived.length > 0,
        updatedAt: iso(page.updatedAt),
      };
    });
  });
}

export async function createPage(
  deps: AppDeps,
  staff: StaffContext,
  userId: string,
  input: { slug: string; title: string },
  meta: RequestMeta,
): Promise<{ id: string }> {
  const { municipality } = staff;
  try {
    return await withTenant(deps.db, { municipalityId: municipality.id, userId }, async (tx) => {
      const [page] = await tx
        .insert(pages)
        .values({
          municipalityId: municipality.id,
          slug: input.slug,
          title: input.title,
          createdByUserId: userId,
        })
        .returning();
      if (!page) throw new Error("page insert returned no row");
      await tx.insert(revisions).values({
        municipalityId: municipality.id,
        pageId: page.id,
        revisionNumber: 1,
        title: input.title,
        blocks: [],
        authorUserId: userId,
      });
      await recordAudit(tx, {
        municipalityId: municipality.id,
        actorKind: "staff",
        actorUserId: userId,
        action: "content.page_created",
        entityType: "website_page",
        entityId: page.id,
        metadata: { slug: page.slug },
        ...meta,
      });
      return { id: page.id };
    });
  } catch (err) {
    if (isUniqueViolation(err, "website_pages_tenant_slug")) {
      throw conflict(
        "slug_taken",
        "Another page already uses that web address. Choose a different one.",
      );
    }
    throw err;
  }
}

export async function getPage(deps: AppDeps, staff: StaffContext, userId: string, id: string) {
  return withTenant(deps.db, { municipalityId: staff.municipality.id, userId }, async (tx) => {
    const page = await loadPage(tx, id);
    const all = await loadRevisions(tx, page.id);
    const c = classify(all, new Date());
    const author = alias(users, "author");
    const reviewer = alias(users, "reviewer");
    const names = await tx
      .select({ id: revisions.id, authorName: author.name, reviewerName: reviewer.name })
      .from(revisions)
      .leftJoin(author, eq(author.id, revisions.authorUserId))
      .leftJoin(reviewer, eq(reviewer.id, revisions.reviewerUserId))
      .where(eq(revisions.pageId, page.id));
    const nameOf = new Map(names.map((n) => [n.id, n]));

    const summary = (r: RevisionRow) => ({
      id: r.id,
      revisionNumber: r.revisionNumber,
      title: r.title,
      status: r.status,
      displayStatus: c.display(r),
      version: r.version,
      authorName: nameOf.get(r.id)?.authorName ?? null,
      reviewerName: nameOf.get(r.id)?.reviewerName ?? null,
      reviewNote: r.reviewNote,
      submittedAt: isoOrNull(r.submittedAt),
      reviewedAt: isoOrNull(r.reviewedAt),
      publishAt: isoOrNull(r.publishAt),
      publishedAt: isoOrNull(r.publishedAt),
      archivedAt: isoOrNull(r.archivedAt),
      createdAt: iso(r.createdAt),
      updatedAt: iso(r.updatedAt),
    });
    const withBlocks = (r: RevisionRow | null) =>
      r ? { ...summary(r), blocks: parseBlocks(r.blocks) } : null;

    const can = (p: ContentWorkflowPermission) => staff.permissions.has(p);
    const hasPublished = c.live !== null || c.scheduled.length > 0;
    // What the editor starts from: the draft if there is one, otherwise a copy of what is
    // live (or was last archived), which will be saved as a new draft revision.
    const source =
      c.working?.status === "draft"
        ? c.working
        : (c.live ?? c.scheduled[0] ?? c.archived[0] ?? null);

    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      showInNav: page.showInNav,
      navOrder: page.navOrder,
      createdAt: iso(page.createdAt),
      updatedAt: iso(page.updatedAt),
      live: withBlocks(c.live),
      scheduled: withBlocks(c.scheduled[0] ?? null),
      working: withBlocks(c.working),
      editorContent: {
        title: source?.title ?? page.title,
        blocks: source ? parseBlocks(source.blocks) : [],
        expectedVersion: c.working?.status === "draft" ? c.working.version : null,
      },
      revisions: all.map(summary),
      actions: {
        canSaveDraft: can("content.edit") && c.working?.status !== "in_review",
        canSubmit: can("content.edit") && c.working?.status === "draft",
        canPublish: can("content.publish") && c.working?.status === "in_review",
        canRequestChanges: can("content.publish") && c.working?.status === "in_review",
        canArchive: can("content.publish") && hasPublished,
        canRestore:
          can("content.edit") && !hasPublished && c.working === null && c.archived.length > 0,
        canEditNavigation: can("content.publish"),
      },
    };
  });
}

export async function saveDraft(
  deps: AppDeps,
  staff: StaffContext,
  userId: string,
  id: string,
  input: SaveDraftInput,
  meta: RequestMeta,
): Promise<{ revisionId: string; version: number }> {
  const { municipality } = staff;
  const stale = () =>
    conflict(
      "stale_draft",
      "This page was changed by someone else while you were editing. Reload to see the latest version.",
    );
  try {
    return await withTenant(deps.db, { municipalityId: municipality.id, userId }, async (tx) => {
      const page = await loadPage(tx, id);
      const c = classify(await loadRevisions(tx, page.id), new Date());
      if (c.working?.status === "in_review") {
        throw conflict(
          "in_review",
          "This page is waiting for review and cannot be edited until the reviewer responds.",
        );
      }

      let saved: { id: string; version: number; revisionNumber: number } | undefined;
      if (c.working) {
        if (input.expectedVersion !== c.working.version) throw stale();
        [saved] = await tx
          .update(revisions)
          .set({
            title: input.title,
            blocks: input.blocks,
            version: c.working.version + 1,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(revisions.id, c.working.id),
              eq(revisions.version, c.working.version),
              eq(revisions.status, "draft"),
            ),
          )
          .returning({
            id: revisions.id,
            version: revisions.version,
            revisionNumber: revisions.revisionNumber,
          });
        if (!saved) throw stale();
      } else {
        // A draft appeared and vanished (e.g. was published) since the editor loaded the page.
        if (input.expectedVersion !== null) throw stale();
        [saved] = await tx
          .insert(revisions)
          .values({
            municipalityId: municipality.id,
            pageId: page.id,
            revisionNumber: await nextRevisionNumber(tx, page.id),
            title: input.title,
            blocks: input.blocks,
            authorUserId: userId,
          })
          .returning({
            id: revisions.id,
            version: revisions.version,
            revisionNumber: revisions.revisionNumber,
          });
        if (!saved) throw new Error("revision insert returned no row");
      }
      await tx
        .update(pages)
        .set({ title: input.title, updatedAt: new Date() })
        .where(eq(pages.id, page.id));
      await recordAudit(tx, {
        municipalityId: municipality.id,
        actorKind: "staff",
        actorUserId: userId,
        action: "content.draft_saved",
        entityType: "website_page",
        entityId: page.id,
        metadata: { slug: page.slug, revisionNumber: saved.revisionNumber, version: saved.version },
        ...meta,
      });
      return { revisionId: saved.id, version: saved.version };
    });
  } catch (err) {
    // Two editors started a new draft at the same moment; the second one loses.
    if (
      isUniqueViolation(err, "content_revisions_one_working_idx") ||
      isUniqueViolation(err, "content_revisions_page_number")
    ) {
      throw stale();
    }
    throw err;
  }
}

/** Moves the working revision between states, guarded by its stored status. */
async function moveWorking(
  tx: Tx,
  revision: RevisionRow,
  to: ContentRevisionStatus,
  extra: Partial<typeof revisions.$inferInsert>,
) {
  const updated = await tx
    .update(revisions)
    .set({ status: to, updatedAt: new Date(), ...extra })
    .where(and(eq(revisions.id, revision.id), eq(revisions.status, revision.status)))
    .returning({ id: revisions.id });
  if (updated.length === 0) {
    throw conflict(
      "stale_status",
      "This page was just updated by someone else. Reload and try again.",
    );
  }
}

export async function submitForReview(
  deps: AppDeps,
  staff: StaffContext,
  userId: string,
  id: string,
  meta: RequestMeta,
) {
  const { municipality } = staff;
  await withTenant(deps.db, { municipalityId: municipality.id, userId }, async (tx) => {
    const page = await loadPage(tx, id);
    const { working } = classify(await loadRevisions(tx, page.id), new Date());
    if (!working || working.status !== "draft") {
      throw conflict("no_draft", "There is no draft to submit. Save your changes first.");
    }
    transitionOrThrow(staff, "draft", "in_review");
    if (parseBlocks(working.blocks).length === 0) {
      throw unprocessable(
        "empty_page",
        "Add some content to the page before submitting it for review.",
      );
    }
    await moveWorking(tx, working, "in_review", { submittedAt: new Date(), reviewNote: null });
    await recordAudit(tx, {
      municipalityId: municipality.id,
      actorKind: "staff",
      actorUserId: userId,
      action: "content.revision_submitted",
      entityType: "website_page",
      entityId: page.id,
      metadata: { slug: page.slug, revisionNumber: working.revisionNumber },
      ...meta,
    });
    await notify(
      tx,
      municipality.id,
      await publisherUserIds(tx, userId),
      `Page "${working.title}" is waiting for review`,
      `/${page.slug}`,
      page.id,
    );
  });
}

export async function publishRevision(
  deps: AppDeps,
  staff: StaffContext,
  userId: string,
  id: string,
  input: { publishAt?: string },
  meta: RequestMeta,
): Promise<{ scheduledFor: string | null }> {
  const { municipality } = staff;
  return withTenant(deps.db, { municipalityId: municipality.id, userId }, async (tx) => {
    const page = await loadPage(tx, id);
    const now = new Date();
    const { working, scheduled } = classify(await loadRevisions(tx, page.id), now);
    if (!working || working.status !== "in_review") {
      throw conflict(
        "not_in_review",
        "Only a page that has been submitted for review can be published.",
      );
    }
    transitionOrThrow(staff, "in_review", "published");
    const publishAt = input.publishAt ? new Date(input.publishAt) : null;
    if (publishAt && publishAt.getTime() <= now.getTime()) {
      throw unprocessable(
        "publish_at_in_past",
        "Choose a publication time in the future, or publish now.",
      );
    }
    await moveWorking(tx, working, "published", {
      reviewerUserId: userId,
      reviewedAt: now,
      publishedAt: now,
      publishAt,
      reviewNote: null,
    });

    // An older revision scheduled for *after* this one would silently replace it later.
    // Approving newer content cancels those; they stay in history as archived.
    const effective = publishAt ?? now;
    const overtaken = scheduled.filter((r) => effectiveTime(r) > effective).map((r) => r.id);
    if (overtaken.length > 0) {
      await tx
        .update(revisions)
        .set({ status: "archived", archivedAt: now, updatedAt: now })
        .where(inArray(revisions.id, overtaken));
    }
    await tx
      .update(pages)
      .set({ title: working.title, updatedAt: now })
      .where(eq(pages.id, page.id));
    await recordAudit(tx, {
      municipalityId: municipality.id,
      actorKind: "staff",
      actorUserId: userId,
      action: publishAt ? "content.revision_scheduled" : "content.revision_published",
      entityType: "website_page",
      entityId: page.id,
      metadata: {
        slug: page.slug,
        revisionNumber: working.revisionNumber,
        authorUserId: working.authorUserId,
        publishAt: isoOrNull(publishAt),
        cancelledScheduledRevisions: overtaken.length,
      },
      ...meta,
    });
    if (working.authorUserId && working.authorUserId !== userId) {
      await notify(
        tx,
        municipality.id,
        [working.authorUserId],
        publishAt
          ? `Page "${working.title}" was approved and scheduled`
          : `Page "${working.title}" was approved and published`,
        `/${page.slug}`,
        page.id,
      );
    }
    return { scheduledFor: isoOrNull(publishAt) };
  });
}

export async function requestChanges(
  deps: AppDeps,
  staff: StaffContext,
  userId: string,
  id: string,
  note: string,
  meta: RequestMeta,
) {
  const { municipality } = staff;
  await withTenant(deps.db, { municipalityId: municipality.id, userId }, async (tx) => {
    const page = await loadPage(tx, id);
    const { working } = classify(await loadRevisions(tx, page.id), new Date());
    if (!working || working.status !== "in_review") {
      throw conflict("not_in_review", "This page is not waiting for review.");
    }
    transitionOrThrow(staff, "in_review", "draft", note);
    await moveWorking(tx, working, "draft", {
      reviewerUserId: userId,
      reviewedAt: new Date(),
      reviewNote: note,
      version: working.version + 1,
    });
    await recordAudit(tx, {
      municipalityId: municipality.id,
      actorKind: "staff",
      actorUserId: userId,
      action: "content.changes_requested",
      entityType: "website_page",
      entityId: page.id,
      metadata: { slug: page.slug, revisionNumber: working.revisionNumber },
      ...meta,
    });
    if (working.authorUserId && working.authorUserId !== userId) {
      await notify(
        tx,
        municipality.id,
        [working.authorUserId],
        `Changes requested on page "${working.title}"`,
        note.slice(0, 140),
        page.id,
      );
    }
  });
}

export async function archivePage(
  deps: AppDeps,
  staff: StaffContext,
  userId: string,
  id: string,
  meta: RequestMeta,
) {
  const { municipality } = staff;
  await withTenant(deps.db, { municipalityId: municipality.id, userId }, async (tx) => {
    const page = await loadPage(tx, id);
    const all = await loadRevisions(tx, page.id);
    const published = all.filter((r) => r.status === "published");
    if (published.length === 0) throw conflict("not_published", "This page is not published.");
    transitionOrThrow(staff, "published", "archived");
    const now = new Date();
    await tx
      .update(revisions)
      .set({ status: "archived", archivedAt: now, updatedAt: now })
      .where(and(eq(revisions.pageId, page.id), eq(revisions.status, "published")));
    await tx.update(pages).set({ updatedAt: now }).where(eq(pages.id, page.id));
    await recordAudit(tx, {
      municipalityId: municipality.id,
      actorKind: "staff",
      actorUserId: userId,
      action: "content.page_archived",
      entityType: "website_page",
      entityId: page.id,
      metadata: { slug: page.slug, revisions: published.length },
      ...meta,
    });
  });
}

export async function restorePage(
  deps: AppDeps,
  staff: StaffContext,
  userId: string,
  id: string,
  meta: RequestMeta,
) {
  const { municipality } = staff;
  try {
    await withTenant(deps.db, { municipalityId: municipality.id, userId }, async (tx) => {
      const page = await loadPage(tx, id);
      const c = classify(await loadRevisions(tx, page.id), new Date());
      const source = c.archived[0];
      if (!source || c.live || c.scheduled.length > 0 || c.working) {
        throw conflict("not_archived", "Only an archived page with no draft can be restored.");
      }
      transitionOrThrow(staff, "archived", "draft");
      // History stays intact: the archived revision is copied into a new draft, which has to
      // be reviewed and approved again before it is public.
      const revisionNumber = await nextRevisionNumber(tx, page.id);
      await tx.insert(revisions).values({
        municipalityId: municipality.id,
        pageId: page.id,
        revisionNumber,
        title: source.title,
        blocks: source.blocks,
        authorUserId: userId,
      });
      await tx.update(pages).set({ updatedAt: new Date() }).where(eq(pages.id, page.id));
      await recordAudit(tx, {
        municipalityId: municipality.id,
        actorKind: "staff",
        actorUserId: userId,
        action: "content.page_restored",
        entityType: "website_page",
        entityId: page.id,
        metadata: { slug: page.slug, fromRevisionNumber: source.revisionNumber, revisionNumber },
        ...meta,
      });
    });
  } catch (err) {
    if (isUniqueViolation(err, "content_revisions_one_working_idx")) {
      throw conflict("not_archived", "Only an archived page with no draft can be restored.");
    }
    throw err;
  }
}

export async function updateNavigation(
  deps: AppDeps,
  staff: StaffContext,
  userId: string,
  id: string,
  input: { showInNav: boolean; navOrder: number },
  meta: RequestMeta,
) {
  const { municipality } = staff;
  await withTenant(deps.db, { municipalityId: municipality.id, userId }, async (tx) => {
    const page = await loadPage(tx, id);
    await tx
      .update(pages)
      .set({ showInNav: input.showInNav, navOrder: input.navOrder, updatedAt: new Date() })
      .where(eq(pages.id, page.id));
    await recordAudit(tx, {
      municipalityId: municipality.id,
      actorKind: "staff",
      actorUserId: userId,
      action: "content.navigation_updated",
      entityType: "website_page",
      entityId: page.id,
      metadata: { slug: page.slug, ...input },
      ...meta,
    });
  });
}

/* ───────────────────────────── Staff: announcements ───────────────────────────── */

type AnnouncementRow = typeof announcements.$inferSelect;
export type AnnouncementStatus = "draft" | "published" | "expired";

function announcementStatus(a: AnnouncementRow, now: Date): AnnouncementStatus {
  if (!a.publishedAt) return "draft";
  return a.expiresAt && a.expiresAt <= now ? "expired" : "published";
}

const toAnnouncement = (a: AnnouncementRow, now: Date) => ({
  id: a.id,
  title: a.title,
  body: a.body,
  status: announcementStatus(a, now),
  publishedAt: isoOrNull(a.publishedAt),
  expiresAt: isoOrNull(a.expiresAt),
  createdAt: iso(a.createdAt),
});

export async function listAnnouncements(deps: AppDeps, staff: StaffContext, userId: string) {
  return withTenant(deps.db, { municipalityId: staff.municipality.id, userId }, async (tx) => {
    const rows = await tx
      .select()
      .from(announcements)
      .orderBy(desc(announcements.createdAt), desc(announcements.id));
    const now = new Date();
    return rows.map((a) => toAnnouncement(a, now));
  });
}

async function loadAnnouncement(tx: Tx, id: string) {
  const [row] = await tx.select().from(announcements).where(eq(announcements.id, id));
  if (!row) throw notFound("Announcement");
  return row;
}

const announcementAudit = (
  staff: StaffContext,
  userId: string,
  action: string,
  id: string,
  meta: RequestMeta,
) => ({
  municipalityId: staff.municipality.id,
  actorKind: "staff" as const,
  actorUserId: userId,
  action,
  entityType: "announcement",
  entityId: id,
  ...meta,
});

export async function createAnnouncement(
  deps: AppDeps,
  staff: StaffContext,
  userId: string,
  input: { title: string; body: string },
  meta: RequestMeta,
): Promise<{ id: string }> {
  const { municipality } = staff;
  return withTenant(deps.db, { municipalityId: municipality.id, userId }, async (tx) => {
    // Always created as a draft: publishing is a separate, permissioned step.
    const [row] = await tx
      .insert(announcements)
      .values({ municipalityId: municipality.id, ...input })
      .returning();
    if (!row) throw new Error("announcement insert returned no row");
    await recordAudit(
      tx,
      announcementAudit(staff, userId, "content.announcement_created", row.id, meta),
    );
    if (!staff.permissions.has("content.publish")) {
      await notify(
        tx,
        municipality.id,
        await publisherUserIds(tx, userId),
        `Announcement "${row.title}" is waiting to be published`,
        "",
        row.id,
      );
    }
    return { id: row.id };
  });
}

export async function updateAnnouncement(
  deps: AppDeps,
  staff: StaffContext,
  userId: string,
  id: string,
  input: { title: string; body: string },
  meta: RequestMeta,
) {
  await withTenant(deps.db, { municipalityId: staff.municipality.id, userId }, async (tx) => {
    const row = await loadAnnouncement(tx, id);
    // Changing text the public can already see is publishing, not drafting.
    if (row.publishedAt && !staff.permissions.has("content.publish")) {
      throw forbidden("Only staff who can publish may change a published announcement.");
    }
    await tx.update(announcements).set(input).where(eq(announcements.id, row.id));
    await recordAudit(
      tx,
      announcementAudit(staff, userId, "content.announcement_updated", row.id, meta),
    );
  });
}

export async function publishAnnouncement(
  deps: AppDeps,
  staff: StaffContext,
  userId: string,
  id: string,
  input: { expiresAt?: string },
  meta: RequestMeta,
) {
  await withTenant(deps.db, { municipalityId: staff.municipality.id, userId }, async (tx) => {
    const row = await loadAnnouncement(tx, id);
    const now = new Date();
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && expiresAt <= now) {
      throw unprocessable(
        "expires_at_in_past",
        "Choose an end time in the future, or leave it empty.",
      );
    }
    await tx
      .update(announcements)
      .set({ publishedAt: now, expiresAt })
      .where(eq(announcements.id, row.id));
    await recordAudit(tx, {
      ...announcementAudit(staff, userId, "content.announcement_published", row.id, meta),
      metadata: { expiresAt: isoOrNull(expiresAt) },
    });
  });
}

export async function expireAnnouncement(
  deps: AppDeps,
  staff: StaffContext,
  userId: string,
  id: string,
  meta: RequestMeta,
) {
  await withTenant(deps.db, { municipalityId: staff.municipality.id, userId }, async (tx) => {
    const row = await loadAnnouncement(tx, id);
    const now = new Date();
    if (announcementStatus(row, now) !== "published") {
      throw conflict("not_published", "This announcement is not currently published.");
    }
    await tx.update(announcements).set({ expiresAt: now }).where(eq(announcements.id, row.id));
    await recordAudit(
      tx,
      announcementAudit(staff, userId, "content.announcement_expired", row.id, meta),
    );
  });
}

/* ───────────────────────────── Public ───────────────────────────── */

async function assertWebsiteEnabled(tx: Tx) {
  const [entitlement] = await tx
    .select({ enabled: moduleEntitlements.enabled })
    .from(moduleEntitlements)
    .where(eq(moduleEntitlements.moduleKey, "website"));
  if (!entitlement?.enabled) throw notFound("Page");
}

/** The live revision of each page: published, effective now or earlier, latest wins. */
function liveRevisions(tx: Tx) {
  return tx
    .selectDistinctOn([revisions.pageId], {
      pageId: revisions.pageId,
      title: revisions.title,
      blocks: revisions.blocks,
      effectiveAt: sql<string>`${effectiveSql}`,
    })
    .from(revisions)
    .where(and(eq(revisions.status, "published"), sql`${effectiveSql} <= now()`))
    .orderBy(revisions.pageId, desc(effectiveSql), desc(revisions.revisionNumber));
}

export async function listPublicNavPages(deps: AppDeps, municipality: Municipality) {
  return withTenant(deps.db, { municipalityId: municipality.id }, async (tx) => {
    await assertWebsiteEnabled(tx);
    const live = await liveRevisions(tx);
    const navPages = await tx
      .select({ id: pages.id, slug: pages.slug, navOrder: pages.navOrder })
      .from(pages)
      .where(eq(pages.showInNav, true))
      .orderBy(asc(pages.navOrder), asc(pages.title));
    return navPages.flatMap((p) => {
      const revision = live.find((r) => r.pageId === p.id);
      return revision ? [{ slug: p.slug, title: revision.title }] : [];
    });
  });
}

export async function getPublicPage(deps: AppDeps, municipality: Municipality, slug: string) {
  return withTenant(deps.db, { municipalityId: municipality.id }, async (tx) => {
    await assertWebsiteEnabled(tx);
    const [page] = await tx
      .select({ id: pages.id, slug: pages.slug })
      .from(pages)
      .where(eq(pages.slug, slug));
    if (!page) throw notFound("Page");
    const [revision] = (await liveRevisions(tx)).filter((r) => r.pageId === page.id);
    // Drafts, pages in review, future-scheduled and archived pages do not exist publicly.
    if (!revision) throw notFound("Page");
    return {
      slug: page.slug,
      title: revision.title,
      blocks: parseBlocks(revision.blocks),
      publishedAt: new Date(revision.effectiveAt).toISOString(),
    };
  });
}
