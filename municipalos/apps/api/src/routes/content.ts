/**
 * Website CMS routes. `registerStaffContentRoutes` attaches to the staff sub-app, so every
 * route here already sits behind `requireSession` + `requireStaff`; `registerPublicContentRoutes`
 * attaches to the public sub-app and only ever serves live, published content.
 */
import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import {
  announcementSchema,
  contentBlockSchema,
  createPageSchema,
  pageNavigationSchema,
  publishAnnouncementSchema,
  publishRevisionSchema,
  requestChangesSchema,
  saveDraftSchema,
  slugSchema,
} from "@municipalos/validation";
import { CONTENT_REVISION_STATUSES } from "@municipalos/workflows";
import type { Context } from "hono";
import type { AppDeps, AppEnv, Municipality } from "../context";
import { notFound } from "../errors";
import { assertCan } from "../middleware/auth";
import { body, errorResponses, idParam, json, okSchema, slugParam } from "../schemas";
import {
  archivePage,
  createAnnouncement,
  createPage,
  expireAnnouncement,
  getPage,
  getPublicPage,
  listAnnouncements,
  listPages,
  listPublicNavPages,
  publishAnnouncement,
  publishRevision,
  requestChanges,
  restorePage,
  saveDraft,
  submitForReview,
  updateAnnouncement,
  updateNavigation,
} from "../services/content";

const security = [{ bearerAuth: [] }];
const ok = { ok: true as const };
const blocks = z.array(contentBlockSchema);

const pageListItemSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    showInNav: z.boolean(),
    navOrder: z.number(),
    isLive: z.boolean(),
    scheduledFor: z.string().nullable(),
    workingStatus: z.enum(["draft", "in_review"]).nullable(),
    isArchived: z.boolean(),
    updatedAt: z.string(),
  })
  .openapi("WebsitePageListItem");

const revisionSchema = z
  .object({
    id: z.string(),
    revisionNumber: z.number(),
    title: z.string(),
    status: z.enum(CONTENT_REVISION_STATUSES),
    displayStatus: z.enum(["draft", "in_review", "live", "scheduled", "superseded", "archived"]),
    version: z.number(),
    authorName: z.string().nullable(),
    reviewerName: z.string().nullable(),
    reviewNote: z.string().nullable(),
    submittedAt: z.string().nullable(),
    reviewedAt: z.string().nullable(),
    publishAt: z.string().nullable(),
    publishedAt: z.string().nullable(),
    archivedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("ContentRevision");

const revisionWithBlocksSchema = revisionSchema.extend({ blocks }).nullable();

const pageDetailSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    showInNav: z.boolean(),
    navOrder: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
    live: revisionWithBlocksSchema,
    scheduled: revisionWithBlocksSchema,
    working: revisionWithBlocksSchema,
    editorContent: z.object({ title: z.string(), blocks, expectedVersion: z.number().nullable() }),
    revisions: z.array(revisionSchema),
    actions: z.object({
      canSaveDraft: z.boolean(),
      canSubmit: z.boolean(),
      canPublish: z.boolean(),
      canRequestChanges: z.boolean(),
      canArchive: z.boolean(),
      canRestore: z.boolean(),
      canEditNavigation: z.boolean(),
    }),
  })
  .openapi("WebsitePageDetail");

const announcementItemSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    body: z.string(),
    status: z.enum(["draft", "published", "expired"]),
    publishedAt: z.string().nullable(),
    expiresAt: z.string().nullable(),
    createdAt: z.string(),
  })
  .openapi("StaffAnnouncement");

const publicPageSchema = z
  .object({ slug: z.string(), title: z.string(), blocks, publishedAt: z.string() })
  .openapi("PublicWebsitePage");

export function registerStaffContentRoutes(app: OpenAPIHono<AppEnv>, deps: AppDeps) {
  const tags = ["Staff · Website"];
  const ctx = (c: Context<AppEnv>) => ({
    staff: c.get("staff"),
    userId: c.get("auth").user.id,
    meta: { ip: c.get("ip"), requestId: c.get("requestId") },
  });

  app.openapi(
    createRoute({
      method: "get",
      path: "/{slug}/content/pages",
      tags,
      security,
      summary: "Website pages with their publication state",
      request: { params: slugParam },
      responses: {
        200: json(z.object({ items: z.array(pageListItemSchema) }), "Pages"),
        ...errorResponses,
      },
    }),
    async (c) => {
      assertCan(c, "content.read");
      const { staff, userId } = ctx(c);
      return c.json({ items: await listPages(deps, staff, userId) }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/{slug}/content/pages",
      tags,
      security,
      summary: "Create a page (starts as an empty draft)",
      request: { params: slugParam, body: body(createPageSchema) },
      responses: { 201: json(z.object({ id: z.string() }), "Page created"), ...errorResponses },
    }),
    async (c) => {
      assertCan(c, "content.edit");
      const { staff, userId, meta } = ctx(c);
      return c.json(await createPage(deps, staff, userId, c.req.valid("json"), meta), 201);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/{slug}/content/pages/{id}",
      tags,
      security,
      summary: "A page with its live, scheduled and working revisions and full history",
      request: { params: idParam },
      responses: { 200: json(pageDetailSchema, "Page"), ...errorResponses },
    }),
    async (c) => {
      assertCan(c, "content.read");
      const { staff, userId } = ctx(c);
      return c.json(await getPage(deps, staff, userId, c.req.valid("param").id), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "put",
      path: "/{slug}/content/pages/{id}/draft",
      tags,
      security,
      summary: "Save the draft (creates a new draft revision if the page has none)",
      description:
        "`expectedVersion` must equal the draft's current `version` (or be null when no draft exists). A mismatch returns 409 `stale_draft` instead of overwriting someone else's edit. The published revision stays live while a draft is edited.",
      request: { params: idParam, body: body(saveDraftSchema) },
      responses: {
        200: json(z.object({ revisionId: z.string(), version: z.number() }), "Draft saved"),
        ...errorResponses,
      },
    }),
    async (c) => {
      assertCan(c, "content.edit");
      const { staff, userId, meta } = ctx(c);
      return c.json(
        await saveDraft(deps, staff, userId, c.req.valid("param").id, c.req.valid("json"), meta),
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/{slug}/content/pages/{id}/submit",
      tags,
      security,
      summary: "Submit the draft for review",
      request: { params: idParam },
      responses: { 200: json(okSchema, "Submitted"), ...errorResponses },
    }),
    async (c) => {
      assertCan(c, "content.edit");
      const { staff, userId, meta } = ctx(c);
      await submitForReview(deps, staff, userId, c.req.valid("param").id, meta);
      return c.json(ok, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/{slug}/content/pages/{id}/publish",
      tags,
      security,
      summary: "Approve the revision in review and publish it now or at a scheduled time",
      request: { params: idParam, body: body(publishRevisionSchema) },
      responses: {
        200: json(z.object({ scheduledFor: z.string().nullable() }), "Published or scheduled"),
        ...errorResponses,
      },
    }),
    async (c) => {
      assertCan(c, "content.publish");
      const { staff, userId, meta } = ctx(c);
      return c.json(
        await publishRevision(
          deps,
          staff,
          userId,
          c.req.valid("param").id,
          c.req.valid("json"),
          meta,
        ),
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/{slug}/content/pages/{id}/request-changes",
      tags,
      security,
      summary: "Send the revision in review back to draft with a note",
      request: { params: idParam, body: body(requestChangesSchema) },
      responses: { 200: json(okSchema, "Returned to draft"), ...errorResponses },
    }),
    async (c) => {
      assertCan(c, "content.publish");
      const { staff, userId, meta } = ctx(c);
      await requestChanges(
        deps,
        staff,
        userId,
        c.req.valid("param").id,
        c.req.valid("json").note,
        meta,
      );
      return c.json(ok, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/{slug}/content/pages/{id}/archive",
      tags,
      security,
      summary: "Take a published page off the public site",
      request: { params: idParam },
      responses: { 200: json(okSchema, "Archived"), ...errorResponses },
    }),
    async (c) => {
      assertCan(c, "content.publish");
      const { staff, userId, meta } = ctx(c);
      await archivePage(deps, staff, userId, c.req.valid("param").id, meta);
      return c.json(ok, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/{slug}/content/pages/{id}/restore",
      tags,
      security,
      summary: "Copy an archived page into a new draft (it must be reviewed again)",
      request: { params: idParam },
      responses: { 200: json(okSchema, "Restored as draft"), ...errorResponses },
    }),
    async (c) => {
      assertCan(c, "content.edit");
      const { staff, userId, meta } = ctx(c);
      await restorePage(deps, staff, userId, c.req.valid("param").id, meta);
      return c.json(ok, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "put",
      path: "/{slug}/content/pages/{id}/navigation",
      tags,
      security,
      summary: "Show or hide a page in the website navigation and set its order",
      request: { params: idParam, body: body(pageNavigationSchema) },
      responses: { 200: json(okSchema, "Navigation updated"), ...errorResponses },
    }),
    async (c) => {
      assertCan(c, "content.publish");
      const { staff, userId, meta } = ctx(c);
      await updateNavigation(
        deps,
        staff,
        userId,
        c.req.valid("param").id,
        c.req.valid("json"),
        meta,
      );
      return c.json(ok, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/{slug}/content/announcements",
      tags,
      security,
      summary: "All announcements including drafts and expired ones",
      request: { params: slugParam },
      responses: {
        200: json(z.object({ items: z.array(announcementItemSchema) }), "Announcements"),
        ...errorResponses,
      },
    }),
    async (c) => {
      assertCan(c, "content.read");
      const { staff, userId } = ctx(c);
      return c.json({ items: await listAnnouncements(deps, staff, userId) }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/{slug}/content/announcements",
      tags,
      security,
      summary: "Create an announcement as a draft",
      request: { params: slugParam, body: body(announcementSchema) },
      responses: { 201: json(z.object({ id: z.string() }), "Draft created"), ...errorResponses },
    }),
    async (c) => {
      assertCan(c, "content.edit");
      const { staff, userId, meta } = ctx(c);
      return c.json(await createAnnouncement(deps, staff, userId, c.req.valid("json"), meta), 201);
    },
  );

  app.openapi(
    createRoute({
      method: "put",
      path: "/{slug}/content/announcements/{id}",
      tags,
      security,
      summary: "Edit an announcement (published ones need content.publish)",
      request: { params: idParam, body: body(announcementSchema) },
      responses: { 200: json(okSchema, "Updated"), ...errorResponses },
    }),
    async (c) => {
      assertCan(c, "content.edit");
      const { staff, userId, meta } = ctx(c);
      await updateAnnouncement(
        deps,
        staff,
        userId,
        c.req.valid("param").id,
        c.req.valid("json"),
        meta,
      );
      return c.json(ok, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/{slug}/content/announcements/{id}/publish",
      tags,
      security,
      summary: "Publish an announcement, optionally until an end time",
      request: { params: idParam, body: body(publishAnnouncementSchema) },
      responses: { 200: json(okSchema, "Published"), ...errorResponses },
    }),
    async (c) => {
      assertCan(c, "content.publish");
      const { staff, userId, meta } = ctx(c);
      await publishAnnouncement(
        deps,
        staff,
        userId,
        c.req.valid("param").id,
        c.req.valid("json"),
        meta,
      );
      return c.json(ok, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/{slug}/content/announcements/{id}/expire",
      tags,
      security,
      summary: "Stop showing a published announcement",
      request: { params: idParam },
      responses: { 200: json(okSchema, "Expired"), ...errorResponses },
    }),
    async (c) => {
      assertCan(c, "content.publish");
      const { staff, userId, meta } = ctx(c);
      await expireAnnouncement(deps, staff, userId, c.req.valid("param").id, meta);
      return c.json(ok, 200);
    },
  );
}

export function registerPublicContentRoutes(
  app: OpenAPIHono<AppEnv>,
  deps: AppDeps,
  municipality: (slug: string) => Promise<Municipality>,
) {
  const tags = ["Public"];

  app.openapi(
    createRoute({
      method: "get",
      path: "/municipalities/{slug}/pages",
      tags,
      summary: "Published pages that appear in the website navigation",
      request: { params: slugParam },
      responses: {
        200: json(
          z.object({ items: z.array(z.object({ slug: z.string(), title: z.string() })) }),
          "Navigation pages",
        ),
        ...errorResponses,
      },
    }),
    async (c) =>
      c.json(
        { items: await listPublicNavPages(deps, await municipality(c.req.valid("param").slug)) },
        200,
      ),
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/municipalities/{slug}/pages/{pageSlug}",
      tags,
      summary: "A published website page",
      request: { params: slugParam.extend({ pageSlug: z.string().min(1).max(63) }) },
      responses: { 200: json(publicPageSchema, "Page"), ...errorResponses },
    }),
    async (c) => {
      const { slug, pageSlug } = c.req.valid("param");
      const parsed = slugSchema.safeParse(pageSlug);
      if (!parsed.success) throw notFound("Page");
      return c.json(await getPublicPage(deps, await municipality(slug), parsed.data), 200);
    },
  );
}
