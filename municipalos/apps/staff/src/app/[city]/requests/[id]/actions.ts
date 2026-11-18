"use server";

import { revalidatePath } from "next/cache";
import { serviceRequestStatusSchema } from "@municipalos/validation";
import { serviceRequestStatusLabel } from "@municipalos/workflows";
import { actionError, api } from "@/lib/api";
import { MAX_PHOTO_BYTES, PHOTO_TYPES, uploadPhoto } from "@/lib/files";
import { base } from "@/lib/staff";
import type { ActionState } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refresh(slug: string, id: string) {
  revalidatePath(`/${slug}/requests/${id}`);
  revalidatePath(`/${slug}`, "layout");
}

export async function changeStatusAction(
  slug: string,
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const to = serviceRequestStatusSchema.safeParse(formData.get("to"));
  if (!to.success) return { error: "Choose an action." };
  const note = String(formData.get("note") ?? "").trim();
  try {
    await api(`${base(slug)}/service-requests/${id}/status`, {
      method: "POST",
      json: { to: to.data, note: note || undefined },
    });
  } catch (err) {
    return actionError(err);
  }
  refresh(slug, id);
  return { success: `Status changed to ${serviceRequestStatusLabel(to.data)}.` };
}

export async function assignAction(
  slug: string,
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const assigneeUserId = String(formData.get("assigneeUserId") ?? "");
  if (!UUID.test(assigneeUserId)) return { error: "Choose a staff member to assign." };
  try {
    await api(`${base(slug)}/service-requests/${id}/assign`, {
      method: "POST",
      json: { assigneeUserId },
    });
  } catch (err) {
    return actionError(err);
  }
  refresh(slug, id);
  return { success: "Assignment saved." };
}

export async function commentAction(
  slug: string,
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const body = String(formData.get("body") ?? "").trim();
  const visibility = formData.get("visibility") === "public" ? "public" : "internal";
  if (body.length < 2) return { error: "Write a note or message first." };
  try {
    await api(`${base(slug)}/service-requests/${id}/comments`, {
      method: "POST",
      json: { body, visibility },
    });
  } catch (err) {
    return actionError(err);
  }
  refresh(slug, id);
  return {
    success: visibility === "public" ? "Message sent to the resident." : "Internal note added.",
  };
}

export async function photoAction(
  slug: string,
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo to add." };
  if (!PHOTO_TYPES.includes(file.type))
    return { error: "Photos must be JPEG, PNG or WebP images." };
  if (file.size > MAX_PHOTO_BYTES) return { error: "Photos must be 15 MB or smaller." };
  try {
    await uploadPhoto(`${base(slug)}/service-requests/${id}/attachments`, file);
  } catch (err) {
    return actionError(err);
  }
  refresh(slug, id);
  return { success: "Photo added. The resident can see it on the tracking page." };
}
