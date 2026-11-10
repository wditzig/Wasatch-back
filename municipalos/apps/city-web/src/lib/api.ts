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
