export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  departmentId: string;
  departmentName: string;
  keywords: string[];
  isActive: boolean;
  sortOrder: number;
}

export interface StaffMember {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  title: string | null;
  roleId: string;
  roleKey: string;
  roleName: string;
  departmentId: string | null;
  departmentName: string | null;
  status: "active" | "suspended";
  isSelf: boolean;
}

export interface Role {
  id: string;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: { key: string; description: string }[];
}

export interface MunicipalSettings {
  branding: { primaryColor: string; tagline?: string };
  contact: { address: string; phone: string; email: string; hours: string };
  allowAnonymousRequests: boolean;
}

export interface Department {
  id: string;
  name: string;
}

export interface AdminFormState {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
}

export const ADMIN_SECTIONS = [
  { path: "categories", label: "Request categories", permission: "categories.manage" },
  { path: "staff", label: "Staff access", permission: "staff.read" },
  { path: "settings", label: "City settings", permission: "settings.manage" },
  { path: "records", label: "Records", permission: "records.manage" },
] as const;

export interface RetentionPolicy {
  recordType: "service_request";
  retentionDays: number | null;
  authority: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface DispositionReview {
  retentionDays: number | null;
  eligible: {
    id: string;
    reference: string;
    categoryName: string;
    closedAt: string;
    eligibleSince: string;
  }[];
  onHold: number;
  dispositioned: number;
}

export interface LegalHold {
  id: string;
  reason: string;
  placedByName: string | null;
  placedAt: string;
  releasedByName: string | null;
  releasedAt: string | null;
  releaseNote: string | null;
}
