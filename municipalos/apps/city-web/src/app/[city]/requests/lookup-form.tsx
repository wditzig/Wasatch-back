"use client";

import { useActionState } from "react";
import { Search } from "lucide-react";
import { Button, Field } from "@municipalos/ui";
import { lookupRequest, type SimpleFormState } from "./actions";

export function LookupForm({ city }: { city: string }) {
  const [state, action, pending] = useActionState<SimpleFormState, FormData>(
    lookupRequest.bind(null, city),
    {},
  );
  return (
    <form action={action} noValidate className="space-y-4">
      <Field
        id="reference"
        label="Tracking number"
        hint="You received this when you submitted your request."
        error={state.error}
      >
        {(p) => (
          <input
            {...p}
            name="reference"
            type="text"
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={20}
            defaultValue={state.value}
            className={`${p.className} font-mono uppercase`}
          />
        )}
      </Field>
      <Button
        type="submit"
        variant="city"
        aria-disabled={pending}
        onClick={(e) => pending && e.preventDefault()}
      >
        <Search className="size-4" aria-hidden="true" />
        {pending ? "Looking…" : "Find my request"}
      </Button>
    </form>
  );
}
