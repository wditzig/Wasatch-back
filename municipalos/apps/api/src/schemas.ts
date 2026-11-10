import { z } from "@hono/zod-openapi";
import { serviceRequestStatusSchema } from "@municipalos/validation";

export const errorSchema = z
  .object({
    error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
    requestId: z.string(),
  })
  .openapi("Error");

const errorContent = { "application/json": { schema: errorSchema } };
export const errorResponses = {
  400: { description: "Malformed request", content: errorContent },
  401: { description: "Not signed in", content: errorContent },
  403: { description: "Not permitted", content: errorContent },
  404: { description: "Not found", content: errorContent },
  409: { description: "Conflict with current state", content: errorContent },
  422: { description: "Validation failed", content: errorContent },
  429: { description: "Rate limited", content: errorContent },
} as const;

export const json = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { "application/json": { schema } },
});
export const body = <T extends z.ZodType>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});

export const okSchema = z.object({ ok: z.literal(true) }).openapi("Ok");
export const slugParam = z.object({ slug: z.string().min(1).max(63) });
export const idParam = slugParam.extend({ id: z.uuid() });

const status = serviceRequestStatusSchema;
export const paginationSchema = z.object({ page: z.number(), pageSize: z.number(), total: z.number() });

export const municipalitySummarySchema = z
  .object({ slug: z.string(), name: z.string(), state: z.string() })
  .openapi("MunicipalitySummary");

export const categorySchema = z
  .object({ id: z.string(), slug: z.string(), name: z.string(), description: z.string(), departmentName: z.string() })
  .openapi("ServiceCategory");

export const siteSchema = z
  .object({
    municipality: municipalitySummarySchema,
    branding: z.object({ primaryColor: z.string(), tagline: z.string().optional() }),
    contact: z.object({ address: z.string(), phone: z.string(), email: z.string(), hours: z.string() }),
    allowAnonymousRequests: z.boolean(),
    modules: z.array(z.string()),
    departments: z.array(
      z.object({ slug: z.string(), name: z.string(), description: z.string(), phone: z.string().nullable(), email: z.string().nullable() }),
    ),
    announcements: z.array(z.object({ id: z.string(), title: z.string(), body: z.string(), publishedAt: z.string() })),
  })
  .openapi("MunicipalSite");

export const createdRequestSchema = z
  .object({
    reference: z.string(),
    status,
    categoryName: z.string(),
    departmentName: z.string(),
    createdAt: z.string(),
    created: z.boolean(),
  })
  .openapi("CreatedServiceRequest");

export const publicRequestSchema = z
  .object({
    reference: z.string(),
    status,
    statusLabel: z.string(),
    isOpen: z.boolean(),
    description: z.string(),
    locationText: z.string(),
    categoryName: z.string(),
    departmentName: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    timeline: z.array(
      z.object({
        id: z.string(),
        type: z.string(),
        toStatus: status.nullable(),
        body: z.string().nullable(),
        from: z.enum(["resident", "city"]),
        createdAt: z.string(),
      }),
    ),
  })
  .openapi("PublicServiceRequest");

export const suggestionSchema = z
  .object({
    suggestions: z.array(z.object({ categoryId: z.string(), name: z.string(), matched: z.array(z.string()) })),
    possibleEmergency: z.boolean(),
  })
  .openapi("CategorySuggestions");

export const requestListItemSchema = z
  .object({
    id: z.string(),
    reference: z.string(),
    status,
    statusLabel: z.string(),
    description: z.string(),
    locationText: z.string(),
    categoryName: z.string(),
    departmentId: z.string(),
    departmentName: z.string(),
    assignee: z.object({ id: z.string(), name: z.string() }).nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("ServiceRequestListItem");

export const requestDetailSchema = requestListItemSchema
  .extend({
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    reporter: z.object({ name: z.string().nullable(), email: z.string().nullable(), phone: z.string().nullable() }),
    resolvedAt: z.string().nullable(),
    closedAt: z.string().nullable(),
    events: z.array(
      z.object({
        id: z.string(),
        type: z.string(),
        visibility: z.enum(["public", "internal"]),
        fromStatus: status.nullable(),
        toStatus: status.nullable(),
        body: z.string().nullable(),
        actorKind: z.enum(["resident", "staff", "system"]),
        actorName: z.string().nullable(),
        subjectName: z.string().nullable(),
        createdAt: z.string(),
      }),
    ),
    availableTransitions: z.array(z.object({ to: status, label: z.string(), requiresNote: z.boolean() })),
    possibleDuplicates: z.array(
      z.object({ id: z.string(), reference: z.string(), status, locationText: z.string(), createdAt: z.string() }),
    ),
  })
  .openapi("ServiceRequestDetail");

export const dashboardSchema = z
  .object({
    hasRequestAccess: z.boolean(),
    statusCounts: z.array(z.object({ status, label: z.string(), count: z.number() })),
    myQueue: z.array(requestListItemSchema),
    needsTriage: z.array(requestListItemSchema),
    metrics: z
      .object({
        open: z.number(),
        receivedLast7Days: z.number(),
        resolvedLast30Days: z.number(),
        avgHoursToResolveLast30Days: z.number().nullable(),
      })
      .nullable(),
  })
  .openapi("StaffDashboard");

export const userSchema = z.object({ id: z.string(), email: z.string(), name: z.string() });

export const meSchema = z
  .object({
    user: userSchema,
    memberships: z.array(
      z.object({ municipality: municipalitySummarySchema, title: z.string().nullable() }),
    ),
  })
  .openapi("Me");

export const staffMeSchema = z
  .object({
    user: userSchema,
    municipality: municipalitySummarySchema,
    membership: z.object({
      title: z.string().nullable(),
      roleKey: z.string(),
      roleName: z.string(),
      departmentId: z.string().nullable(),
    }),
    permissions: z.array(z.string()),
    unreadNotifications: z.number(),
  })
  .openapi("StaffMe");

export const notificationSchema = z
  .object({
    id: z.string(),
    subject: z.string(),
    body: z.string(),
    entityType: z.string().nullable(),
    entityId: z.string().nullable(),
    createdAt: z.string(),
    readAt: z.string().nullable(),
  })
  .openapi("Notification");

export const auditEventSchema = z
  .object({
    id: z.string(),
    action: z.string(),
    actorKind: z.string(),
    actorName: z.string().nullable(),
    entityType: z.string().nullable(),
    entityId: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()),
    createdAt: z.string(),
  })
  .openapi("AuditEvent");
