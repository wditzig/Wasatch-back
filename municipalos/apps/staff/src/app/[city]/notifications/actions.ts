"use server";

import { revalidatePath } from "next/cache";
import { ApiError, api } from "@/lib/api";
import { base } from "@/lib/staff";

export async function markReadAction(slug: string, id: string | null): Promise<void> {
  try {
    await api(`${base(slug)}/notifications/read`, { method: "POST", json: id ? { id } : {} });
  } catch (err) {
    // 404: already read (e.g. in another tab). Refreshing the list is the right outcome.
    if (!(err instanceof ApiError && err.status === 404)) throw err;
  }
  revalidatePath(`/${slug}`, "layout");
}
