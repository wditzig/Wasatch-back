"use server";

import { redirect } from "next/navigation";
import { ApiError, api, clearSessionCookie, hasSessionCookie, setSessionCookie } from "./api";
import type { ActionState, User } from "./types";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email address and password." };
  try {
    const res = await api<{ token: string; expiresAt: string; user: User }>("/v1/auth/login", {
      method: "POST",
      json: { email, password },
      auth: false,
    });
    await setSessionCookie(res.token, res.expiresAt);
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        error:
          err.code === "validation_failed"
            ? "Enter a valid email address and password."
            : err.message,
      };
    }
    throw err;
  }
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  if (await hasSessionCookie()) {
    try {
      await api("/v1/auth/logout", { method: "POST" });
    } catch (err) {
      // The session may already be gone; the cookie is cleared regardless. Redirect signals propagate.
      if (!(err instanceof ApiError)) throw err;
      console.error("[staff] logout call failed", err);
    }
  }
  await clearSessionCookie();
  redirect("/login");
}
