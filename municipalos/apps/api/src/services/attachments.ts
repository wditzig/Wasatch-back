import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  count,
  eq,
  serviceRequestAttachments as attachments,
  serviceRequestEvents as events,
  serviceRequests as requests,
  sql,
  users,
  withTenant,
  type Tx,
} from "@municipalos/database";
import { serviceRequestVisibility } from "@municipalos/permissions";
import { serviceRequestWorkflow } from "@municipalos/workflows";
import type { AppDeps, Municipality, StaffContext } from "../context";
import { conflict, notFound } from "../errors";
import { recordAudit } from "../lib/audit";
import { processUploadedImage } from "../lib/images";
import { departmentStaffUserIds, notifyStaffUsers } from "./notify";
import type { RequestMeta } from "./service-requests";

export const MAX_RESIDENT_PHOTOS = 4;
export const MAX_PHOTOS_PER_REQUEST = 12;

export interface PhotoSummary {
  id: string;
  kind: "report" | "completion";
  width: number;
  height: number;
  createdAt: string;
}

export async function listPhotos(
  tx: Tx,
  requestId: string,
): Promise<(PhotoSummary & { uploadedByName: string | null })[]> {
  const rows = await tx
    .select({
      id: attachments.id,
      kind: attachments.kind,
      width: attachments.width,
      height: attachments.height,
      createdAt: attachments.createdAt,
      uploadedByName: users.name,
    })
    .from(attachments)
    .leftJoin(users, eq(users.id, attachments.uploadedByUserId))
    .where(eq(attachments.requestId, requestId))
    .orderBy(asc(attachments.createdAt), asc(attachments.id));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

async function storePhoto(
  deps: AppDeps,
  tx: Tx,
  municipalityId: string,
  request: { id: string },
  file: Buffer,
  uploader: { kind: "resident" } | { kind: "staff"; userId: string },
  limit: { max: number; ofKind?: "report" },
): Promise<string> {
  const [existing] = await tx
    .select({ value: count() })
    .from(attachments)
    .where(
      and(
        eq(attachments.requestId, request.id),
        limit.ofKind ? eq(attachments.kind, limit.ofKind) : undefined,
      ),
    );
  if ((existing?.value ?? 0) >= limit.max) {
    throw conflict(
      "too_many_photos",
      `This request already has the maximum of ${limit.max} photos.`,
    );
  }

  const image = await processUploadedImage(file);
  const id = randomUUID();
  // Tenant and request are part of the key so objects are separable per municipality.
  const storageKey = `${municipalityId}/requests/${request.id}/${id}.jpg`;
  await deps.storage.put(storageKey, image.bytes, image.contentType);
  await tx.insert(attachments).values({
    id,
    municipalityId,
    requestId: request.id,
    kind: uploader.kind === "staff" ? "completion" : "report",
    storageKey,
    contentType: image.contentType,
    sizeBytes: image.bytes.length,
    width: image.width,
    height: image.height,
    uploadedByKind: uploader.kind,
    uploadedByUserId: uploader.kind === "staff" ? uploader.userId : null,
  });
  await tx.insert(events).values({
    municipalityId,
    requestId: request.id,
    type: "photo_added",
    visibility: "public",
    actorKind: uploader.kind,
    actorUserId: uploader.kind === "staff" ? uploader.userId : null,
  });
  await tx.update(requests).set({ updatedAt: new Date() }).where(eq(requests.id, request.id));
  return id;
}

/** A resident (anyone holding the tracking number) adds a photo to an open request. */
export async function addResidentPhoto(
  deps: AppDeps,
  municipality: Municipality,
  reference: string,
  file: Buffer,
  meta: RequestMeta,
): Promise<{ id: string }> {
  return withTenant(deps.db, { municipalityId: municipality.id }, async (tx) => {
    const [request] = await tx.select().from(requests).where(eq(requests.reference, reference));
    if (!request) throw notFound("Request");
    if (!serviceRequestWorkflow.states[request.status].open) {
      throw conflict("request_not_open", "Photos can only be added while a request is open.");
    }
    const id = await storePhoto(
      deps,
      tx,
      municipality.id,
      request,
      file,
      { kind: "resident" },
      { max: MAX_RESIDENT_PHOTOS, ofKind: "report" },
    );
    await recordAudit(tx, {
      municipalityId: municipality.id,
      actorKind: "resident",
      action: "service_request.photo_added",
      entityType: "service_request",
      entityId: request.id,
      metadata: { reference: request.reference, attachmentId: id },
      ...meta,
    });
    const recipients = request.assignedToUserId
      ? [request.assignedToUserId]
      : await departmentStaffUserIds(tx, request.departmentId);
    await notifyStaffUsers(
      tx,
      municipality.id,
      recipients,
      `Resident added a photo to ${request.reference}`,
      request.locationText,
      request.id,
    );
    return { id };
  });
}

function staffScope(staff: StaffContext) {
  const v = serviceRequestVisibility(staff.permissions, staff.membership.departmentId);
  return v.scope === "all"
    ? undefined
    : v.scope === "department"
      ? eq(requests.departmentId, v.departmentId)
      : sql`false`;
}

/** Staff add a photo (for example of the completed repair). Visible to the resident. */
export async function addStaffPhoto(
  deps: AppDeps,
  staff: StaffContext,
  userId: string,
  requestId: string,
  file: Buffer,
  meta: RequestMeta,
): Promise<{ id: string }> {
  const municipalityId = staff.municipality.id;
  return withTenant(deps.db, { municipalityId, userId }, async (tx) => {
    const [request] = await tx
      .select()
      .from(requests)
      .where(and(eq(requests.id, requestId), staffScope(staff)));
    if (!request) throw notFound("Request");
    const id = await storePhoto(
      deps,
      tx,
      municipalityId,
      request,
      file,
      { kind: "staff", userId },
      { max: MAX_PHOTOS_PER_REQUEST },
    );
    await recordAudit(tx, {
      municipalityId,
      actorKind: "staff",
      actorUserId: userId,
      action: "service_request.photo_added",
      entityType: "service_request",
      entityId: request.id,
      metadata: { reference: request.reference, attachmentId: id },
      ...meta,
    });
    return { id };
  });
}

async function readBytes(
  deps: AppDeps,
  row: { storageKey: string; contentType: string } | undefined,
) {
  if (!row) throw notFound("Photo");
  const bytes = await deps.storage.get(row.storageKey);
  if (!bytes) {
    console.error(`[storage] object missing for key ${row.storageKey}`);
    throw notFound("Photo");
  }
  return { bytes, contentType: row.contentType };
}

/** Photo bytes for the holder of the tracking number. The photo must belong to that request. */
export async function getPublicPhoto(
  deps: AppDeps,
  municipality: Municipality,
  reference: string,
  attachmentId: string,
) {
  const row = await withTenant(deps.db, { municipalityId: municipality.id }, async (tx) => {
    const [found] = await tx
      .select({ storageKey: attachments.storageKey, contentType: attachments.contentType })
      .from(attachments)
      .innerJoin(requests, eq(requests.id, attachments.requestId))
      .where(and(eq(attachments.id, attachmentId), eq(requests.reference, reference)));
    return found;
  });
  return readBytes(deps, row);
}

/** Photo bytes for staff, limited to requests the staff member may see. */
export async function getStaffPhoto(
  deps: AppDeps,
  staff: StaffContext,
  userId: string,
  requestId: string,
  attachmentId: string,
) {
  const row = await withTenant(
    deps.db,
    { municipalityId: staff.municipality.id, userId },
    async (tx) => {
      const [found] = await tx
        .select({ storageKey: attachments.storageKey, contentType: attachments.contentType })
        .from(attachments)
        .innerJoin(requests, eq(requests.id, attachments.requestId))
        .where(
          and(eq(attachments.id, attachmentId), eq(requests.id, requestId), staffScope(staff)),
        );
      return found;
    },
  );
  return readBytes(deps, row);
}
