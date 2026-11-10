import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "mos_staff_session";
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
  /** Set false for calls made before a session exists (login). */
  auth?: boolean;
}

/**
 * Server-to-server call to the MunicipalOS API. The session token lives only in an httpOnly
 * cookie and is attached here, so it is never readable by browser scripts. The API remains the
 * authorization boundary; nothing in this app decides what a user may see.
 */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", json, auth = true } = options;
  const requestHeaders: Record<string, string> = { accept: "application/json" };

  const incoming = await headers();
  const forwarded = incoming.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) requestHeaders["x-forwarded-for"] = forwarded;

  if (auth) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token) redirect("/login");
    requestHeaders.authorization = `Bearer ${token}`;
  }
  if (json !== undefined) requestHeaders["content-type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: json === undefined ? undefined : JSON.stringify(json),
      cache: "no-store",
    });
  } catch (cause) {
    console.error(`[staff] API unreachable: ${method} ${path}`, cause);
    throw new ApiError(
      503,
      "api_unreachable",
      "The MunicipalOS service is temporarily unavailable. Please try again.",
    );
  }

  if (res.ok) return (await res.json()) as T;

  // The session expired or was revoked: clear the stale cookie and send the user to sign in.
  if (res.status === 401 && auth) redirect("/session-expired");

  let code = "unknown_error";
  let message = "Something went wrong. Please try again.";
  let details: unknown;
  try {
    const body = (await res.json()) as {
      error?: { code?: string; message?: string; details?: unknown };
    };
    code = body.error?.code ?? code;
    message = body.error?.message ?? message;
    details = body.error?.details;
  } catch {
    // Non-JSON error body: keep the generic message.
  }
  throw new ApiError(res.status, code, message, details);
}

export async function setSessionCookie(token: string, expiresAt: string): Promise<void> {
  const maxAge = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function hasSessionCookie(): Promise<boolean> {
  return Boolean((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Turns an unexpected failure inside a server action into a message for the form. */
export function actionError(err: unknown): { error: string } {
  if (err instanceof ApiError) return { error: err.message };
  throw err; // includes Next.js redirect/notFound signals, which must propagate
}
