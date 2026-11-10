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
