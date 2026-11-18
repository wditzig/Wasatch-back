import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, SESSION_COOKIE } from "./api";

const API_URL = process.env.API_URL ?? "http://localhost:4000";
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

async function token(): Promise<string> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) redirect("/login");
  return value;
}

async function failure(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  return new ApiError(
    res.status,
    body?.error?.code ?? "unknown_error",
    body?.error?.message ?? "Something went wrong. Please try again.",
  );
}

/** Forwards one uploaded photo to the API, which validates and re-encodes it. */
export async function uploadPhoto(path: string, file: File): Promise<void> {
  const form = new FormData();
  form.set("file", file, "photo");
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${await token()}` },
    body: form,
    cache: "no-store",
  });
  if (res.status === 401) redirect("/session-expired");
  if (!res.ok) throw await failure(res);
}

/** Streams a photo from the API to the browser. Authorization is decided by the API. */
export async function fetchPhoto(path: string): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { authorization: `Bearer ${await token()}` },
    cache: "no-store",
  });
  if (!res.ok) return new Response("Not found", { status: res.status === 401 ? 401 : 404 });
  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}

/** Streams a file download (record or audit export) from the API to the browser. */
export async function fetchDownload(path: string): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { authorization: `Bearer ${await token()}` },
    cache: "no-store",
  });
  if (res.status === 401) redirect("/session-expired");
  if (!res.ok) return new Response("Not found", { status: 404 });
  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": res.headers.get("content-disposition") ?? "attachment",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
