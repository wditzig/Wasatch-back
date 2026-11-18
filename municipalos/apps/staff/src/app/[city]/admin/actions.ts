"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { base } from "@/lib/staff";
import type { AdminFormState } from "./types";

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function failure(err: unknown): AdminFormState {
  if (!(err instanceof ApiError)) throw err; // includes Next.js redirect/notFound signals
  const issues =
    (err.details as { issues?: { path: string; message: string }[] } | undefined)?.issues ?? [];
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues)
    fieldErrors[issue.path.split(".").pop() ?? issue.path] ??= issue.message;
  return { error: issues.length ? "Please fix the highlighted fields." : err.message, fieldErrors };
}

const keywords = (form: FormData) =>
  str(form, "keywords")
    .split(/[,\n]/)
    .map((k) => k.trim())
    .filter(Boolean);

export async function createCategoryAction(
  slug: string,
  _prev: AdminFormState,
  form: FormData,
): Promise<AdminFormState> {
  try {
    await api(`${base(slug)}/admin/categories`, {
      method: "POST",
      json: {
        name: str(form, "name"),
        description: str(form, "description"),
        departmentId: str(form, "departmentId"),
        keywords: keywords(form),
      },
    });
  } catch (err) {
    return failure(err);
  }
  revalidatePath(`/${slug}/admin/categories`);
  return { success: `“${str(form, "name")}” was added. Residents can choose it now.` };
}

export async function updateCategoryAction(
  slug: string,
  id: string,
  _prev: AdminFormState,
  form: FormData,
): Promise<AdminFormState> {
  try {
    await api(`${base(slug)}/admin/categories/${id}`, {
      method: "PATCH",
      json: {
        name: str(form, "name"),
        description: str(form, "description"),
        departmentId: str(form, "departmentId"),
        keywords: keywords(form),
        isActive: form.get("isActive") === "on",
      },
    });
  } catch (err) {
    return failure(err);
  }
  revalidatePath(`/${slug}/admin/categories`);
  redirect(`/${slug}/admin/categories?saved=1`);
}

export async function updateSettingsAction(
  slug: string,
  _prev: AdminFormState,
  form: FormData,
): Promise<AdminFormState> {
  try {
    await api(`${base(slug)}/admin/settings`, {
      method: "PUT",
      json: {
        branding: {
          primaryColor: str(form, "primaryColor"),
          tagline: str(form, "tagline") || undefined,
        },
        contact: {
          address: str(form, "address"),
          phone: str(form, "phone"),
          email: str(form, "email"),
          hours: str(form, "hours"),
        },
        allowAnonymousRequests: form.get("allowAnonymousRequests") === "on",
      },
    });
  } catch (err) {
    return failure(err);
  }
  revalidatePath(`/${slug}/admin/settings`);
  return { success: "Settings saved. The public website shows the changes now." };
}

export async function updateMembershipAction(
  slug: string,
  id: string,
  _prev: AdminFormState,
  form: FormData,
): Promise<AdminFormState> {
  try {
    await api(`${base(slug)}/admin/staff/${id}`, {
      method: "PATCH",
      json: {
        roleId: str(form, "roleId"),
        departmentId: str(form, "departmentId") || null,
        title: str(form, "title") || null,
        status: form.get("suspended") === "on" ? "suspended" : "active",
      },
    });
  } catch (err) {
    return failure(err);
  }
  revalidatePath(`/${slug}/admin/staff`);
  redirect(`/${slug}/admin/staff?saved=1`);
}

export async function updateRetentionAction(
  slug: string,
  _prev: AdminFormState,
  form: FormData,
): Promise<AdminFormState> {
  const permanent = form.get("permanent") === "on";
  const years = Number(str(form, "years"));
  if (!permanent && (!Number.isFinite(years) || years <= 0)) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: { years: "Enter the number of years, or choose to keep records permanently." },
    };
  }
  try {
    await api(`${base(slug)}/records/retention/service_request`, {
      method: "PUT",
      json: {
        retentionDays: permanent ? null : Math.round(years * 365),
        authority: str(form, "authority"),
      },
    });
  } catch (err) {
    return failure(err);
  }
  revalidatePath(`/${slug}/admin/records`);
  return { success: "Retention schedule saved. Nothing is dispositioned automatically." };
}

export async function dispositionAction(
  slug: string,
  _prev: AdminFormState,
  form: FormData,
): Promise<AdminFormState> {
  const requestIds = form.getAll("requestIds").map(String);
  if (requestIds.length === 0) return { error: "Select at least one record." };
  if (form.get("confirm") !== "on")
    return { error: "Confirm that you are authorized to disposition these records." };
  let outcome: { dispositioned: string[]; skipped: { id: string; reason: string }[] };
  try {
    outcome = await api(`${base(slug)}/records/disposition`, {
      method: "POST",
      json: { requestIds, confirm: true },
    });
  } catch (err) {
    return failure(err);
  }
  revalidatePath(`/${slug}/admin/records`);
  // The list re-renders (and may become empty), so report the outcome on the page itself.
  redirect(
    `/${slug}/admin/records?dispositioned=${outcome.dispositioned.length}&skipped=${outcome.skipped.length}`,
  );
}

export async function placeHoldAction(
  slug: string,
  requestId: string,
  _prev: AdminFormState,
  form: FormData,
): Promise<AdminFormState> {
  try {
    await api(`${base(slug)}/service-requests/${requestId}/holds`, {
      method: "POST",
      json: { reason: str(form, "reason") },
    });
  } catch (err) {
    return failure(err);
  }
  revalidatePath(`/${slug}/requests/${requestId}`);
  return {
    success: "Legal hold placed. This record cannot be dispositioned until the hold is released.",
  };
}

export async function releaseHoldAction(
  slug: string,
  requestId: string,
  holdId: string,
  _prev: AdminFormState,
  form: FormData,
): Promise<AdminFormState> {
  try {
    await api(`${base(slug)}/records/holds/${holdId}/release`, {
      method: "POST",
      json: { note: str(form, "note") },
    });
  } catch (err) {
    return failure(err);
  }
  revalidatePath(`/${slug}/requests/${requestId}`);
  return { success: "Legal hold released." };
}
