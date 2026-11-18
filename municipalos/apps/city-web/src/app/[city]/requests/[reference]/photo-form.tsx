"use client";

import { useActionState } from "react";
import { Alert, Button, Field } from "@municipalos/ui";
import { addPhoto, type SimpleFormState } from "../actions";

export function PhotoForm({
  city,
  reference,
  existing,
}: {
  city: string;
  reference: string;
  existing: number;
}) {
  const [state, action, pending] = useActionState<SimpleFormState, FormData>(
    addPhoto.bind(null, city, reference, existing),
    {},
  );
  return (
    <form action={action} noValidate className="space-y-3">
      {state.ok ? (
        <Alert tone="success" live>
          Your photo was added.
        </Alert>
      ) : null}
      <Field
        id="photo"
        label="Add a photo"
        hint="JPEG, PNG or WebP, up to 15 MB. Location data stored in the photo is removed."
        error={state.error}
      >
        {(p) => (
          <input
            {...p}
            key={state.ok ? `sent-${existing}` : "pick"}
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            className="block w-full text-base file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-slate-400 file:bg-white file:px-4 file:text-sm file:font-medium"
          />
        )}
      </Field>
      <Button
        type="submit"
        variant="secondary"
        aria-disabled={pending}
        onClick={(e) => pending && e.preventDefault()}
      >
        {pending ? "Uploading…" : "Upload photo"}
      </Button>
    </form>
  );
}
