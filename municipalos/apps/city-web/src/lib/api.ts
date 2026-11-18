import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { MunicipalSite } from "./types";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

interface ApiOptions {
  method?: "GET" | "POST";
  json?: unknown;
  headers?: Record<string, string>;
}

/** Server-to-server call to the MunicipalOS API. The browser never talks to the API directly. */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const incoming = await headers();
  const forwardedFor = incoming.get("x-forwarded-for");
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.json !== undefined ? { "content-type": "application/json" } : {}),
        ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
        ...options.headers,
      },
      body: options.json === undefined ? undefined : JSON.stringify(options.json),
      cache: "no-store",
    });
  } catch (cause) {
    console.error(`[city-web] API unreachable for ${path}`, cause);
    throw new ApiError(
      503,
      "api_unavailable",
      "The service is temporarily unavailable. Please try again shortly.",
    );
  }
  const payload = (await res.json().catch(() => null)) as {
    error?: { code: string; message: string; details?: unknown };
  } | null;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      payload?.error?.code ?? "unknown",
      payload?.error?.message ?? "Something went wrong.",
      payload?.error?.details,
    );
  }
  return payload as T;
}

/** Loads a municipality's public site data once per request; unknown cities are a 404. */
export const getSite = cache(async (slug: string): Promise<MunicipalSite> => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound();
  try {
    return await api<MunicipalSite>(`/v1/public/municipalities/${slug}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
});

export function fieldErrors(err: ApiError): Record<string, string> {
  const issues =
    (err.details as { issues?: { path: string; message: string }[] } | undefined)?.issues ?? [];
  const out: Record<string, string> = {};
  for (const issue of issues) out[issue.path] ??= issue.message;
  return out;
}

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const MAX_PHOTOS = 4;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Forwards one uploaded photo to the API, which validates and re-encodes it. */
export async function apiUpload(path: string, file: File): Promise<void> {
  const incoming = await headers();
  const forwardedFor = incoming.get("x-forwarded-for");
  const form = new FormData();
  form.set("file", file, "photo");
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: forwardedFor ? { "x-forwarded-for": forwardedFor } : {},
      body: form,
      cache: "no-store",
    });
  } catch (cause) {
    console.error(`[city-web] API unreachable for ${path}`, cause);
    throw new ApiError(
      503,
      "api_unavailable",
      "The service is temporarily unavailable. Please try again shortly.",
    );
  }
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as {
      error?: { code: string; message: string };
    } | null;
    throw new ApiError(
      res.status,
      payload?.error?.code ?? "unknown",
      payload?.error?.message ?? "The photo could not be added.",
    );
  }
}

/** Streams a request photo from the API to the browser. */
export async function apiPhoto(path: string): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return new Response("Not found", { status: 404 });
  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "X-Robots-Tag": "noindex",
    },
  });
}

/** Returns a message if the chosen files cannot be accepted, before anything is sent. */
export function photoProblem(files: File[], alreadyAttached = 0): string | null {
  if (files.length + alreadyAttached > MAX_PHOTOS)
    return `You can attach up to ${MAX_PHOTOS} photos to a request.`;
  for (const f of files) {
    if (!PHOTO_TYPES.includes(f.type)) return "Photos must be JPEG, PNG or WebP images.";
    if (f.size > MAX_PHOTO_BYTES) return "Each photo must be 15 MB or smaller.";
  }
  return null;
}
