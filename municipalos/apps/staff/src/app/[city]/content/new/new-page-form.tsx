"use client";

import { useActionState, useState } from "react";
import { Button, Field } from "@municipalos/ui";
import { createPageAction } from "../actions";
import { Result } from "../result";
import type { ContentActionState } from "../types";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);

export function NewPageForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<ContentActionState, FormData>(
    createPageAction.bind(null, slug),
    {},
  );
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [touched, setTouched] = useState(false);

  return (
    <form action={action} noValidate className="space-y-5">
      <Result state={state} />
      <Field id="title" label="Page title">
        {(p) => (
          <input
            {...p}
            name="title"
            type="text"
            required
            maxLength={120}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!touched) setAddress(slugify(e.target.value));
            }}
          />
        )}
      </Field>
      <Field
        id="slug"
        label="Web address"
        hint="The last part of the page’s address: lowercase letters, numbers and hyphens. It cannot be changed later."
      >
        {(p) => (
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-ink-muted" aria-hidden="true">
              /p/
            </span>
            <input
              {...p}
              name="slug"
              type="text"
              required
              maxLength={63}
              autoCapitalize="none"
              spellCheck={false}
              value={address}
              onChange={(e) => {
                setTouched(true);
                setAddress(e.target.value);
              }}
              className={`${p.className} font-mono`}
            />
          </div>
        )}
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create page"}
      </Button>
    </form>
  );
}
