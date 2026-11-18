/**
 * Permission catalogue and system role definitions.
 *
 * Permissions are the unit of authorization. Roles are named bundles of permissions that are
 * stored per municipality (see `roles` / `role_permissions` tables) so a city can define custom
 * roles. The system roles below are the defaults provisioned for every new municipality.
 *
 * Only permissions that the API actually enforces are listed. Add new permissions together with
 * the feature that checks them.
 */
export const PERMISSIONS = [
  "service_requests.read_all",
  "service_requests.read_department",
  "service_requests.update_status",
  "service_requests.assign",
  "service_requests.comment",
  "service_requests.close",
  "service_requests.reopen",
  "staff.read",
  "staff.manage",
  "categories.manage",
  "settings.manage",
  "content.read",
  "content.edit",
  "content.publish",
  "records.export",
  "records.manage",
  "audit.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  "service_requests.read_all": "View service requests for every department",
  "service_requests.read_department": "View service requests routed to the member's own department",
  "service_requests.update_status": "Review, start and resolve service requests",
  "service_requests.assign": "Assign service requests to staff",
  "service_requests.comment": "Add internal notes and resident-visible messages",
  "service_requests.close": "Close service requests",
  "service_requests.reopen": "Reopen resolved or closed service requests",
  "staff.read": "View the staff directory for the municipality",
  "staff.manage": "Change staff roles, departments and access",
  "categories.manage": "Create and edit service request categories and their routing",
  "settings.manage": "Edit municipal branding, contact details and reporting policy",
  "content.read": "View website content including unpublished drafts",
  "content.edit": "Create and edit website content and submit it for review",
  "content.publish": "Approve, publish, schedule and archive website content",
  "records.export": "Export complete records, for example to answer a public records request",
  "records.manage": "Set retention schedules, place legal holds and carry out approved disposition",
  "audit.read": "View and export the audit log",
};

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export interface SystemRole {
  key: string;
  name: string;
  description: string;
  permissions: readonly Permission[];
}

export const SYSTEM_ROLES = [
  {
    key: "municipal_admin",
    name: "Municipal Administrator",
    description: "Full administrative access within the municipality.",
    permissions: PERMISSIONS,
  },
  {
    key: "department_admin",
    name: "Department Administrator",
    description: "Manages work and staff assignments for one department.",
    permissions: [
      "service_requests.read_department",
      "service_requests.update_status",
      "service_requests.assign",
      "service_requests.comment",
      "service_requests.close",
      "service_requests.reopen",
      "staff.read",
    ],
  },
  {
    key: "department_employee",
    name: "Department Employee",
    description: "Works requests routed to their department.",
    permissions: [
      "service_requests.read_department",
      "service_requests.update_status",
      "service_requests.comment",
    ],
  },
  {
    key: "city_clerk",
    name: "City Clerk",
    description: "Triages incoming requests across departments.",
    permissions: [
      "service_requests.read_all",
      "service_requests.update_status",
      "service_requests.assign",
      "service_requests.comment",
      "staff.read",
      "content.read",
      "content.edit",
      "content.publish",
      "records.export",
      "records.manage",
    ],
  },
  {
    key: "permit_reviewer",
    name: "Permit Reviewer",
    description:
      "Reviews permit applications. (Permitting module not yet built; no permissions yet.)",
    permissions: [],
  },
  {
    key: "content_editor",
    name: "Content Editor",
    description: "Drafts and edits website content. Publishing needs approval.",
    permissions: ["content.read", "content.edit"],
  },
  {
    key: "auditor",
    name: "Read-Only Auditor",
    description: "Read-only access to records and the audit log.",
    permissions: [
      "service_requests.read_all",
      "staff.read",
      "content.read",
      "records.export",
      "audit.read",
    ],
  },
] as const satisfies readonly SystemRole[];

export type SystemRoleKey = (typeof SYSTEM_ROLES)[number]["key"];

export type PermissionSet = ReadonlySet<Permission>;

export function toPermissionSet(values: Iterable<string>): PermissionSet {
  const set = new Set<Permission>();
  for (const v of values) if (isPermission(v)) set.add(v);
  return set;
}

export function can(granted: PermissionSet, permission: Permission): boolean {
  return granted.has(permission);
}

export type RequestVisibility =
  { scope: "all" } | { scope: "department"; departmentId: string } | { scope: "none" };

/**
 * Which service requests may this member see? `read_all` wins; `read_department` only applies
 * when the membership is attached to a department.
 */
export function serviceRequestVisibility(
  granted: PermissionSet,
  departmentId: string | null,
): RequestVisibility {
  if (granted.has("service_requests.read_all")) return { scope: "all" };
  if (granted.has("service_requests.read_department") && departmentId) {
    return { scope: "department", departmentId };
  }
  return { scope: "none" };
}
