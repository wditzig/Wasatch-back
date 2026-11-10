"use server";

import { revalidatePath } from "next/cache";
import { serviceRequestStatusSchema } from "@municipalos/validation";
import { serviceRequestStatusLabel } from "@municipalos/workflows";
import { actionError, api } from "@/lib/api";
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
