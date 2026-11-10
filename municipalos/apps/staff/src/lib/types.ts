/** Response shapes mirroring apps/api/src/schemas.ts. */
import type { ServiceRequestStatus } from "@municipalos/workflows";

export interface MunicipalitySummary {
  slug: string;
  name: string;
  state: string;
}
export interface User {
  id: string;
  email: string;
  name: string;
}
export interface Me {
  user: User;
  memberships: { municipality: MunicipalitySummary; title: string | null }[];
}
export interface StaffMe {
  user: User;
  municipality: MunicipalitySummary;
  membership: {
    title: string | null;
    roleKey: string;
    roleName: string;
    departmentId: string | null;
  };
  permissions: string[];
  unreadNotifications: number;
}
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}
export interface RequestListItem {
  id: string;
  reference: string;
  status: ServiceRequestStatus;
  statusLabel: string;
  description: string;
  locationText: string;
  categoryName: string;
  departmentId: string;
  departmentName: string;
  assignee: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}
export interface RequestEvent {
  id: string;
  type: string;
  visibility: "public" | "internal";
  fromStatus: ServiceRequestStatus | null;
  toStatus: ServiceRequestStatus | null;
  body: string | null;
  actorKind: "resident" | "staff" | "system";
  actorName: string | null;
  subjectName: string | null;
  createdAt: string;
}
export interface AvailableTransition {
  to: ServiceRequestStatus;
  label: string;
  requiresNote: boolean;
}
export interface RequestDetail extends RequestListItem {
  latitude: number | null;
  longitude: number | null;
  reporter: { name: string | null; email: string | null; phone: string | null };
  resolvedAt: string | null;
  closedAt: string | null;
  events: RequestEvent[];
  availableTransitions: AvailableTransition[];
  possibleDuplicates: {
    id: string;
    reference: string;
    status: ServiceRequestStatus;
    locationText: string;
    createdAt: string;
  }[];
}
export interface Dashboard {
  hasRequestAccess: boolean;
  statusCounts: { status: ServiceRequestStatus; label: string; count: number }[];
  myQueue: RequestListItem[];
  needsTriage: RequestListItem[];
  metrics: {
    open: number;
    receivedLast7Days: number;
    resolvedLast30Days: number;
    avgHoursToResolveLast30Days: number | null;
  } | null;
}
export interface AssignableStaff {
  id: string;
  name: string;
  title: string | null;
  roleName: string;
}
export interface StaffNotification {
  id: string;
  subject: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  readAt: string | null;
}
export interface AuditEvent {
  id: string;
  action: string;
  actorKind: string;
  actorName: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
/** Result of a server action rendered inline by the form that invoked it. */
export interface ActionState {
  error?: string;
  success?: string;
}
