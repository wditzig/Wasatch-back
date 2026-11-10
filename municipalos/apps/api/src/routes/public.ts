import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  and, announcements, asc, departments, desc, eq, gt, isNull, lte, moduleEntitlements, municipalities,
  municipalityDomains, municipalitySettings, or, serviceRequestCategories as categories, withTenant,
} from "@municipalos/database";
import {
  createServiceRequestSchema, referenceSchema, residentMessageSchema, suggestCategorySchema,
} from "@municipalos/validation";
import type { AppDeps, AppEnv } from "../context";
import { notFound } from "../errors";
import { looksLikeEmergency, suggestCategories } from "../lib/suggest";
import { findActiveMunicipality } from "../middleware/auth";
import { rateLimit, type RateLimiter } from "../middleware/rate-limit";
import {
  body, categorySchema, createdRequestSchema, errorResponses, json, municipalitySummarySchema, okSchema,
  publicRequestSchema, siteSchema, slugParam, suggestionSchema,
} from "../schemas";
import { addResidentMessage, createServiceRequest, getPublicRequest } from "../services/service-requests";
import { validationHook } from "../validation-hook";

const tags = ["Public"];
const referenceParam = slugParam.extend({ reference: z.string().min(1).max(20) });

export function publicRoutes(deps: AppDeps, limiter: RateLimiter) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });
  const limits = deps.config.rateLimits;
  app.use("*", rateLimit(limiter, "public-read", limits.publicRead));

  const municipality = async (slug: string) => {
    const m = await findActiveMunicipality(deps, slug);
    if (!m) throw notFound("Municipality");
    return m;
  };

  app.openapi(
    createRoute({
      method: "get", path: "/municipalities", tags,
      summary: "List municipalities that use MunicipalOS",
      responses: { 200: json(z.object({ items: z.array(municipalitySummarySchema) }), "Active municipalities") },
    }),
    async (c) => {
      const items = await deps.db
        .select({ slug: municipalities.slug, name: municipalities.name, state: municipalities.state })
        .from(municipalities)
        .where(eq(municipalities.status, "active"))
        .orderBy(asc(municipalities.name));
      return c.json({ items }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get", path: "/domains/{hostname}", tags,
      summary: "Resolve a website hostname to a municipality",
      request: { params: z.object({ hostname: z.string().min(1).max(253) }) },
      responses: { 200: json(municipalitySummarySchema, "Municipality"), ...errorResponses },
    }),
    async (c) => {
      const { hostname } = c.req.valid("param");
      const [row] = await deps.db
        .select({ slug: municipalities.slug, name: municipalities.name, state: municipalities.state })
        .from(municipalityDomains)
        .innerJoin(municipalities, eq(municipalities.id, municipalityDomains.municipalityId))
        .where(and(eq(municipalityDomains.hostname, hostname), eq(municipalities.status, "active")));
      if (!row) throw notFound("Domain");
      return c.json(row, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get", path: "/municipalities/{slug}", tags,
      summary: "Public website data for a municipality",
      request: { params: slugParam },
      responses: { 200: json(siteSchema, "Site data"), ...errorResponses },
    }),
    async (c) => {
      const m = await municipality(c.req.valid("param").slug);
      const site = await withTenant(deps.db, { municipalityId: m.id }, async (tx) => {
        const [settings] = await tx.select().from(municipalitySettings);
        if (!settings) throw notFound("Municipality");
        const modules = await tx.select().from(moduleEntitlements).where(eq(moduleEntitlements.enabled, true));
        const depts = await tx.select().from(departments).orderBy(asc(departments.sortOrder));
        const now = new Date();
        const news = await tx
          .select()
          .from(announcements)
          .where(and(lte(announcements.publishedAt, now), or(isNull(announcements.expiresAt), gt(announcements.expiresAt, now))))
          .orderBy(desc(announcements.publishedAt))
          .limit(5);
        return {
          municipality: { slug: m.slug, name: m.name, state: m.state },
          branding: settings.branding,
          contact: settings.contact,
          allowAnonymousRequests: settings.allowAnonymousRequests,
          modules: modules.map((x) => x.moduleKey),
          departments: depts.map((d) => ({ slug: d.slug, name: d.name, description: d.description, phone: d.phone, email: d.email })),
          announcements: news.map((a) => ({ id: a.id, title: a.title, body: a.body, publishedAt: a.publishedAt!.toISOString() })),
        };
      });
      return c.json(site, 200);
    },
  );

  const activeCategories = (municipalityId: string) =>
    withTenant(deps.db, { municipalityId }, (tx) =>
      tx
        .select({
          id: categories.id, slug: categories.slug, name: categories.name, description: categories.description,
          keywords: categories.keywords, departmentName: departments.name,
        })
        .from(categories)
        .innerJoin(departments, eq(departments.id, categories.departmentId))
        .where(eq(categories.isActive, true))
        .orderBy(asc(categories.sortOrder)),
    );

  app.openapi(
    createRoute({
      method: "get", path: "/municipalities/{slug}/service-categories", tags,
      summary: "Service request categories a resident can choose",
      request: { params: slugParam },
      responses: { 200: json(z.object({ items: z.array(categorySchema) }), "Categories"), ...errorResponses },
    }),
    async (c) => {
      const m = await municipality(c.req.valid("param").slug);
      const items = (await activeCategories(m.id)).map(({ keywords: _k, ...rest }) => rest);
      return c.json({ items }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post", path: "/municipalities/{slug}/service-categories/suggest", tags,
      summary: "Suggest a category for a description (keyword rules; advisory only)",
      request: { params: slugParam, body: body(suggestCategorySchema) },
      responses: { 200: json(suggestionSchema, "Suggestions"), ...errorResponses },
    }),
    async (c) => {
      const m = await municipality(c.req.valid("param").slug);
      const { description } = c.req.valid("json");
      return c.json(
        { suggestions: suggestCategories(description, await activeCategories(m.id)), possibleEmergency: looksLikeEmergency(description) },
        200,
      );
    },
  );

  app.use("/municipalities/:slug/service-requests", rateLimit(limiter, "public-submit", limits.publicSubmit));
  app.openapi(
    createRoute({
      method: "post", path: "/municipalities/{slug}/service-requests", tags,
      summary: "Submit a non-emergency service request",
      description:
        "Send an `Idempotency-Key` header (any unique string per submission) so a retried request does not create a duplicate. Emergencies must be reported by calling 911.",
      request: {
        params: slugParam,
        headers: z.object({ "idempotency-key": z.string().min(8).max(100).optional() }),
        body: body(createServiceRequestSchema),
      },
      responses: {
        201: json(createdRequestSchema, "Request created"),
        200: json(createdRequestSchema, "Idempotent replay of an earlier submission"),
        ...errorResponses,
      },
    }),
    async (c) => {
      const m = await municipality(c.req.valid("param").slug);
      const key = c.req.valid("header")["idempotency-key"] ?? null;
      const result = await createServiceRequest(deps, m, c.req.valid("json"), key, {
        ip: c.get("ip"),
        requestId: c.get("requestId"),
      });
      return c.json(result, result.created ? 201 : 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get", path: "/municipalities/{slug}/service-requests/{reference}", tags,
      summary: "Track a request by its tracking number",
      request: { params: referenceParam },
      responses: { 200: json(publicRequestSchema, "Public view of the request"), ...errorResponses },
    }),
    async (c) => {
      const { slug, reference } = c.req.valid("param");
      const parsed = referenceSchema.safeParse(reference);
      if (!parsed.success) throw notFound("Request");
      return c.json(await getPublicRequest(deps, await municipality(slug), parsed.data), 200);
    },
  );

  app.use("/municipalities/:slug/service-requests/:reference/messages", rateLimit(limiter, "public-message", limits.publicMessage));
  app.openapi(
    createRoute({
      method: "post", path: "/municipalities/{slug}/service-requests/{reference}/messages", tags,
      summary: "Add information to an open request",
      request: { params: referenceParam, body: body(residentMessageSchema) },
      responses: { 201: json(okSchema, "Message added"), ...errorResponses },
    }),
    async (c) => {
      const { slug, reference } = c.req.valid("param");
      const parsed = referenceSchema.safeParse(reference);
      if (!parsed.success) throw notFound("Request");
      await addResidentMessage(deps, await municipality(slug), parsed.data, c.req.valid("json").body, {
        ip: c.get("ip"),
        requestId: c.get("requestId"),
      });
      return c.json({ ok: true as const }, 201);
    },
  );

  return app;
}
