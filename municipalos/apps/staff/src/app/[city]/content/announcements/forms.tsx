"use client";

import { useActionState } from "react";
import { Button, Field } from "@municipalos/ui";
import {
  createAnnouncementAction,
  expireAnnouncementAction,
  publishAnnouncementAction,
  updateAnnouncementAction,
} from "../actions";
import { Result } from "../result";
import type { Announcement, ContentActionState } from "../types";

type State = ContentActionState;

function Fields({
  prefix,
  defaults,
}: {
  prefix: string;
  defaults?: { title: string; body: string };
}) {
  return (
    <>
      <Field id={`${prefix}-title`} label="Title">
        {(p) => (
          <input
            {...p}
            name="title"
            type="text"
            required
            maxLength={160}
            defaultValue={defaults?.title}
          />
        )}
      </Field>
      <Field
        id={`${prefix}-body`}
        label="Announcement text"
        hint="Plain text, shown on the website home page."
      >
        {(p) => (
          <textarea
            {...p}
            name="body"
            rows={3}
            required
            maxLength={2000}
            defaultValue={defaults?.body}
          />
        )}
      </Field>
    </>
  );
}

export function CreateAnnouncementForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<State, FormData>(
    createAnnouncementAction.bind(null, slug),
    {},
  );
  return (
    <form action={action} noValidate className="space-y-4" key={state.success ? "created" : "form"}>
      <Result state={state} />
      <Fields prefix="new" />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save as draft"}
      </Button>
    </form>
  );
}

export function EditAnnouncementForm({ slug, item }: { slug: string; item: Announcement }) {
  const [state, action, pending] = useActionState<State, FormData>(
    updateAnnouncementAction.bind(null, slug, item.id),
    {},
  );
  return (
    <form action={action} noValidate className="space-y-4">
      <Result state={state} />
      <Fields prefix={`edit-${item.id}`} defaults={item} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

export function PublishAnnouncementForm({
  slug,
  item,
  timezone,
}: {
  slug: string;
  item: Announcement;
  timezone: string;
}) {
  const [state, action, pending] = useActionState<State, FormData>(
    publishAnnouncementAction.bind(null, slug, item.id),
    {},
  );
  return (
    <form action={action} noValidate className="space-y-4">
      <Result state={state} />
      <Field
        id={`expires-${item.id}`}
        label="Stop showing after"
        optional
        hint={`Leave empty to show until removed. Times are in the city’s time zone (${timezone}).`}
      >
        {(p) => <input {...p} name="expiresAtLocal" type="datetime-local" />}
      </Field>
      <Button type="submit" disabled={pending} aria-label={`Publish announcement: ${item.title}`}>
        {pending ? "Publishing…" : item.status === "expired" ? "Publish again" : "Publish"}
      </Button>
    </form>
  );
}

export function ExpireAnnouncementForm({ slug, item }: { slug: string; item: Announcement }) {
  const [state, action, pending] = useActionState<State>(
    expireAnnouncementAction.bind(null, slug, item.id),
    {},
  );
  return (
    <form action={action} className="space-y-3">
      <Result state={state} />
      <Button
        type="submit"
        variant="secondary"
        disabled={pending}
        aria-label={`Remove from website: ${item.title}`}
      >
        {pending ? "Removing…" : "Remove from website"}
      </Button>
    </form>
  );
}
