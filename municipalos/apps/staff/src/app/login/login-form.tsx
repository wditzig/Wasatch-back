"use client";

import { useActionState } from "react";
import { Alert, Button, Field } from "@municipalos/ui";
import { loginAction } from "@/lib/session-actions";
import type { ActionState } from "@/lib/types";

const initial: ActionState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);
  return (
    <form action={action} className="space-y-5">
      {state.error ? (
        <Alert tone="error" live>
          {state.error}
        </Alert>
      ) : null}
      <Field id="email" label="Work email">
        {(p) => <input {...p} name="email" type="email" autoComplete="username" required />}
      </Field>
      <Field id="password" label="Password">
        {(p) => (
          <input {...p} name="password" type="password" autoComplete="current-password" required />
        )}
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
