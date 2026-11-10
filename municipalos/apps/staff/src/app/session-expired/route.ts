import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/api";

/** Clears a session cookie the API no longer accepts, then returns the user to sign in. */
export function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login?expired=1", request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
