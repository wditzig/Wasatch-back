import "server-only";
import { notFound } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { base, getStaffMe } from "@/lib/staff";

/** Loads admin data; a role without the permission (403) sees a not-found page. */
export async function adminGet<T>(slug: string, path: string): Promise<T> {
  try {
    return await api<T>(`${base(slug)}${path}`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) notFound();
    throw err;
  }
}

export async function adminContext(params: Promise<{ city: string }>) {
  const me = await getStaffMe((await params).city);
  return { me, slug: me.municipality.slug };
}
