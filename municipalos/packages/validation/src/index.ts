/**
 * Zod schemas shared by the API (runtime validation + OpenAPI) and the web apps (types).
 */
import { z } from "zod";
import { SERVICE_REQUEST_STATUSES } from "@municipalos/workflows";

export const slugSchema = z
  .string()
  .min(2)
  .max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only");

export const serviceRequestStatusSchema = z.enum(SERVICE_REQUEST_STATUSES);

const trimmed = (max: number) => z.string().trim().max(max);
/** Empty strings from HTML forms are treated as "not provided". */
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    trimmed(max).optional(),
  );

export const createServiceRequestSchema = z
  .object({
    categoryId: z.uuid(),
    description: z
      .string()
      .trim()
      .min(10, "Please describe the problem in at least 10 characters")
      .max(2000),
    locationText: z.string().trim().min(3, "Tell us where the problem is").max(300),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    reporterName: optionalText(120),
    reporterEmail: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.email("Enter a valid email address").max(254).optional(),
    ),
    reporterPhone: optionalText(30),
  })
  .refine((v) => (v.latitude === undefined) === (v.longitude === undefined), {
    message: "Latitude and longitude must be provided together",
    path: ["latitude"],
  });
export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>;

export const suggestCategorySchema = z.object({ description: z.string().trim().min(3).max(2000) });

export const residentMessageSchema = z.object({ body: z.string().trim().min(2).max(2000) });

export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});

export const changeStatusSchema = z.object({
  to: serviceRequestStatusSchema,
  /** Explanation recorded in the history. Shown to the resident. */
  note: optionalText(2000),
});
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

export const assignSchema = z.object({ assigneeUserId: z.uuid().nullable() });

export const staffCommentSchema = z.object({
  body: z.string().trim().min(2).max(4000),
  visibility: z.enum(["internal", "public"]),
});

export const listServiceRequestsQuerySchema = z.object({
  status: z.union([serviceRequestStatusSchema, z.enum(["open", "all"])]).default("open"),
  departmentId: z.uuid().optional(),
  assignee: z.enum(["me", "unassigned", "anyone"]).default("anyone"),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(["newest", "oldest", "updated"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListServiceRequestsQuery = z.infer<typeof listServiceRequestsQuerySchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/** Tracking references look like CR-7K3M9Q2X: municipality prefix + 8 Crockford base32 chars. */
export const referenceSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2,4}-[0-9A-HJKMNP-TV-Z]{8}$/, "That doesn't look like a tracking number");

/* ───────────────────────────── Website CMS ───────────────────────────── */

/**
 * URLs editors may link to. Only `https:`, `mailto:`, `tel:` and site-relative paths are
 * accepted, so content can never carry `javascript:`/`data:` links, protocol-relative URLs or
 * plain-HTTP links.
 */
export const safeUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => {
    // No whitespace, control characters or backslashes (browsers treat "\" like "/").
    if (/[\s\\]/.test(value) || [...value].some((ch) => ch.charCodeAt(0) < 0x20)) return false;
    if (value.startsWith("/")) return !value.startsWith("//");
    try {
      return ["https:", "mailto:", "tel:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Use a link that starts with https://, mailto:, tel: or /");

const blockId = z.string().min(1).max(40);
const line = (max: number) => z.string().trim().min(1).max(max);
const optionalLine = (max: number) => optionalText(max);

/**
 * Reusable content blocks. Text is always plain text rendered as text: there is deliberately no
 * HTML or Markdown block, so stored content cannot inject markup or scripts.
 */
export const contentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("heading"),
    id: blockId,
    text: line(120),
    level: z.union([z.literal(2), z.literal(3)]),
  }),
  z.object({ type: z.literal("text"), id: blockId, text: line(5000) }),
  z.object({
    type: z.literal("callout"),
    id: blockId,
    tone: z.enum(["info", "warning"]),
    title: optionalLine(120),
    text: line(1000),
  }),
  z.object({
    type: z.literal("links"),
    id: blockId,
    title: optionalLine(120),
    items: z
      .array(z.object({ label: line(120), url: safeUrlSchema }))
      .min(1)
      .max(12),
  }),
  z.object({
    type: z.literal("contact"),
    id: blockId,
    name: line(120),
    phone: optionalLine(40),
    email: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.email("Enter a valid email address").max(254).optional(),
    ),
    address: optionalLine(300),
    hours: optionalLine(200),
  }),
  z.object({ type: z.literal("service_links"), id: blockId }),
]);
export type ContentBlock = z.infer<typeof contentBlockSchema>;

export const CONTENT_BLOCK_TYPES = [
  "heading",
  "text",
  "callout",
  "links",
  "contact",
  "service_links",
] as const;
export type ContentBlockType = (typeof CONTENT_BLOCK_TYPES)[number];

export const contentBlocksSchema = z
  .array(contentBlockSchema)
  .max(40, "A page can have at most 40 blocks")
  .refine(
    (blocks) => new Set(blocks.map((b) => b.id)).size === blocks.length,
    "Block ids must be unique",
  );

const pageTitle = z.string().trim().min(2, "Enter a page title").max(120);

export const createPageSchema = z.object({ slug: slugSchema, title: pageTitle });

export const saveDraftSchema = z.object({
  title: pageTitle,
  blocks: contentBlocksSchema,
  /** `version` of the draft being edited, or null when starting a new draft. */
  expectedVersion: z.number().int().min(1).nullable(),
});
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;

export const publishRevisionSchema = z.object({
  /** Publish later instead of now. Must be in the future. */
  publishAt: z.iso.datetime({ offset: true }).optional(),
});

export const requestChangesSchema = z.object({
  note: z.string().trim().min(2, "Explain what needs to change").max(2000),
});

export const pageNavigationSchema = z.object({
  showInNav: z.boolean(),
  navOrder: z.number().int().min(0).max(999),
});

export const announcementSchema = z.object({
  title: z.string().trim().min(3, "Enter a title").max(160),
  body: z.string().trim().min(3, "Enter the announcement text").max(2000),
});

export const publishAnnouncementSchema = z.object({
  /** When the announcement should stop showing. Must be in the future. */
  expiresAt: z.iso.datetime({ offset: true }).optional(),
});
