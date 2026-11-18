"use client";

import { useActionState } from "react";
import { Archive, Check, RotateCcw, Undo2 } from "lucide-react";
import { Button, Field } from "@municipalos/ui";
import {
  archiveAction,
  navigationAction,
  publishAction,
  requestChangesAction,
  restoreAction,
} from "../actions";
import { Result } from "../result";
import type { ContentActionState } from "../types";

type State = ContentActionState;
interface Target {
  slug: string;
  pageId: string;
}

export function PublishForm({ slug, pageId, timezone }: Target & { timezone: string }) {
  const [state, action, pending] = useActionState<State, FormData>(
    publishAction.bind(null, slug, pageId),
    {},
  );
  return (
    <form action={action} noValidate className="space-y-4">
      <Result state={state} />
      <Field
        id="publishAtLocal"
        label="Publish at"
        optional
        hint={`Leave empty to publish now. Times are in the city’s time zone (${timezone}).`}
      >
        {(p) => <input {...p} name="publishAtLocal" type="datetime-local" />}
      </Field>
      <Button type="submit" disabled={pending}>
        <Check className="size-4" aria-hidden="true" />
        {pending ? "Publishing…" : "Approve and publish"}
      </Button>
    </form>
  );
}

export function RequestChangesForm({ slug, pageId }: Target) {
  const [state, action, pending] = useActionState<State, FormData>(
    requestChangesAction.bind(null, slug, pageId),
    {},
  );
  return (
    <form action={action} noValidate className="space-y-4">
      <Result state={state} />
      <Field
        id="review-note"
        label="What needs to change?"
        hint="The author sees this note and gets the page back as a draft."
      >
        {(p) => <textarea {...p} name="note" rows={3} maxLength={2000} required />}
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        <Undo2 className="size-4" aria-hidden="true" />
        {pending ? "Sending…" : "Request changes"}
      </Button>
    </form>
  );
}

export function ArchiveForm({ slug, pageId }: Target) {
  const [state, action, pending] = useActionState<State>(
    archiveAction.bind(null, slug, pageId),
    {},
  );
  return (
    <form action={action} className="space-y-3">
      <Result state={state} />
      <p className="text-sm text-ink-muted">
        Archiving removes the page from the public website. Its history is kept and it can be
        restored as a draft.
      </p>
      <Button type="submit" variant="secondary" disabled={pending}>
        <Archive className="size-4" aria-hidden="true" />
        {pending ? "Archiving…" : "Archive page"}
      </Button>
    </form>
  );
}

export function RestoreForm({ slug, pageId }: Target) {
  const [state, action, pending] = useActionState<State>(
    restoreAction.bind(null, slug, pageId),
    {},
  );
  return (
    <form action={action} className="space-y-3">
      <Result state={state} />
      <p className="text-sm text-ink-muted">
        Restoring copies the archived content into a new draft. It must be reviewed again before it
        is public.
      </p>
      <Button type="submit" variant="secondary" disabled={pending}>
        <RotateCcw className="size-4" aria-hidden="true" />
        {pending ? "Restoring…" : "Restore as draft"}
      </Button>
    </form>
  );
}

export function NavigationForm({
  slug,
  pageId,
  showInNav,
  navOrder,
}: Target & { showInNav: boolean; navOrder: number }) {
  const [state, action, pending] = useActionState<State, FormData>(
    navigationAction.bind(null, slug, pageId),
    {},
  );
  return (
    <form action={action} noValidate className="space-y-4">
      <Result state={state} />
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="showInNav"
          defaultChecked={showInNav}
          className="mt-0.5 size-5"
        />
        <span>
          <span className="font-medium text-ink">Show in the website menu</span>
          <span className="block text-ink-muted">Only appears while the page is published.</span>
        </span>
      </label>
      <Field id="navOrder" label="Position in menu" hint="Lower numbers come first.">
        {(p) => (
          <input {...p} name="navOrder" type="number" min={0} max={999} defaultValue={navOrder} />
        )}
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Save menu settings"}
      </Button>
    </form>
  );
}
