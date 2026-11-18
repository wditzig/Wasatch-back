import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every page request. Two jobs:
 *
 * 1. Custom municipal domains. When the request's host is registered to a municipality
 *    (`municipality_domains`), the site is served from the root of that domain:
 *    `cedarridge.example/report` renders `/cedar-ridge/report`. Another city's pages are not
 *    reachable through that domain. Platform hosts (e.g. localhost) keep `/{city}/…` URLs.
 * 2. Content-Security-Policy with a per-request nonce.
 */
const API_URL = process.env.API_URL ?? "http://localhost:4000";
const PLATFORM_HOSTS = new Set(
  (process.env.PLATFORM_HOSTS ?? "localhost,127.0.0.1")
    .split(",")
    .map((h) => h.trim().toLowerCase()),
);
const CACHE_MS = 60_000;
const hostCache = new Map<string, { slug: string | null; expires: number }>();

async function slugForHost(host: string): Promise<string | null> {
  if (PLATFORM_HOSTS.has(host) || !/^[a-z0-9.-]{1,253}$/.test(host)) return null;
  const cached = hostCache.get(host);
  if (cached && cached.expires > Date.now()) return cached.slug;
  let slug: string | null = null;
  try {
    const res = await fetch(`${API_URL}/v1/public/domains/${encodeURIComponent(host)}`, {
      cache: "no-store",
    });
    if (res.ok) slug = ((await res.json()) as { slug: string }).slug;
    else if (res.status !== 404) return cached?.slug ?? null; // API trouble: do not cache a wrong answer
  } catch {
    return cached?.slug ?? null;
  }
  if (hostCache.size > 5000) hostCache.clear();
  hostCache.set(host, { slug, expires: Date.now() + CACHE_MS });
  return slug;
}

function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes carry the per-city brand colour; no inline <script> is allowed.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);

  const host = (request.headers.get("host") ?? "").split(":")[0]!.toLowerCase();
  const slug = await slugForHost(host);
  const { pathname } = request.nextUrl;
  let response: NextResponse;

  if (!slug) {
    response = NextResponse.next({ request: { headers } });
  } else {
    // Links are currently generated with the city prefix, so `/{slug}/…` is accepted on the
    // city's own domain as well as the clean `/…` form. Anything else (including another
    // city's slug) is resolved inside this city and therefore ends in a 404.
    const prefixed = pathname === `/${slug}` || pathname.startsWith(`/${slug}/`);
    const url = request.nextUrl.clone();
    url.pathname = prefixed ? pathname : `/${slug}${pathname === "/" ? "" : pathname}`;
    response = NextResponse.rewrite(url, { request: { headers } });
  }
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|icon.svg|favicon.ico).*)" }],
};
