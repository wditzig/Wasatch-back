import type { ServiceRequestStatus } from "@municipalos/workflows";

export interface MunicipalitySummary {
  slug: string;
  name: string;
  state: string;
}

export interface MunicipalSite {
  municipality: MunicipalitySummary;
  timezone: string;
  branding: { primaryColor: string; tagline?: string };
  contact: { address: string; phone: string; email: string; hours: string };
  allowAnonymousRequests: boolean;
  modules: string[];
  departments: {
    slug: string;
    name: string;
    description: string;
    phone: string | null;
    email: string | null;
  }[];
  announcements: { id: string; title: string; body: string; publishedAt: string }[];
}

export interface ServiceCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  departmentName: string;
}

export interface CategorySuggestions {
  suggestions: { categoryId: string; name: string; matched: string[] }[];
  possibleEmergency: boolean;
}

export interface CreatedServiceRequest {
  reference: string;
  status: ServiceRequestStatus;
}

export interface PublicServiceRequest {
  reference: string;
  status: ServiceRequestStatus;
  statusLabel: string;
  isOpen: boolean;
  description: string;
  locationText: string;
  categoryName: string;
  departmentName: string;
  createdAt: string;
  updatedAt: string;
  timeline: {
    id: string;
    type: "created" | "status_changed" | "staff_message" | "resident_message";
    toStatus: ServiceRequestStatus | null;
    body: string | null;
    from: "resident" | "city";
    createdAt: string;
  }[];
}
