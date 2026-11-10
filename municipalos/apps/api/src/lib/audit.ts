import { auditEvents, type Queryable } from "@municipalos/database";

export interface AuditEntry {
  municipalityId: string | null;
  actorKind: "resident" | "staff" | "system" | "anonymous";
  actorUserId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  requestId?: string;
}

/**
 * Records an audit event. Call it with the same transaction as the change it describes so the
 * record and the change commit or roll back together. Never put secrets or message bodies in
 * `metadata`.
 */
export async function recordAudit(q: Queryable, entry: AuditEntry): Promise<void> {
  await q.insert(auditEvents).values({
    municipalityId: entry.municipalityId,
    actorKind: entry.actorKind,
    actorUserId: entry.actorUserId ?? null,
    action: entry.action,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    metadata: entry.metadata ?? {},
    ip: entry.ip ?? null,
    requestId: entry.requestId ?? null,
  });
}
