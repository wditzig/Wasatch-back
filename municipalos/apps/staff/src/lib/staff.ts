import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ApiError, api } from "./api";
import type { StaffMe } from "./types";

/** The caller's membership in a municipality, deduplicated per request. 403/404 render as not found. */
export const getStaffMe = cache(async (slug: string): Promise<StaffMe> => {
  try {
    return await api<StaffMe>(`/v1/staff/${encodeURIComponent(slug)}/me`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) notFound();
    throw err;
  }
});

export const canSeeRequests = (me: StaffMe) =>
  me.permissions.includes("service_requests.read_all") ||
  me.permissions.includes("service_requests.read_department");

export const base = (slug: string) => `/v1/staff/${encodeURIComponent(slug)}`;
