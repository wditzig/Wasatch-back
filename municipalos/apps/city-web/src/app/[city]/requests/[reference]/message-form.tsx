"use client";

import { useActionState } from "react";
import { Alert, Button, Field } from "@municipalos/ui";
import { addMessage, type SimpleFormState } from "../actions";

export function MessageForm({ city, reference }: { city: string; reference: string }) {
  const [state, action, pending] = useActionState<SimpleFormState, FormData>(
    addMessage.bind(null, city, reference),
    {},
  );
  return (
    <form action={action} noValidate className="space-y-3">
      {state.ok ? (
        <Alert tone="success" live>
          Your message was added. City staff have been notified.
        </Alert>
      ) : null}
      <Field
        id="body"
        label="Add information for city staff"
        hint="For example, an answer to a question or a change in the situation. Do not include sensitive personal information."
        error={state.error}
      >
        {(p) => (
          <textarea
            {...p}
            name="body"
            rows={3}
            required
            maxLength={2000}
            defaultValue={state.value}
            key={state.ok ? "sent" : "draft"}
          />
        )}
      </Field>
      <Button
        type="submit"
        variant="secondary"
        aria-disabled={pending}
        onClick={(e) => pending && e.preventDefault()}
      >
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
