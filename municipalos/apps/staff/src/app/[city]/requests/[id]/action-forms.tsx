"use client";

import { useActionState } from "react";
import { Alert, Button, Field } from "@municipalos/ui";
import type { ActionState, AssignableStaff, AvailableTransition } from "@/lib/types";
import { assignAction, changeStatusAction, commentAction } from "./actions";

const initial: ActionState = {};

function Result({ state }: { state: ActionState }) {
  if (state.error)
    return (
      <Alert tone="error" live>
        {state.error}
      </Alert>
    );
  if (state.success)
    return (
      <Alert tone="success" live>
        {state.success}
      </Alert>
    );
  return null;
}

export function StatusForm({
  slug,
  id,
  transitions,
}: {
  slug: string;
  id: string;
  transitions: AvailableTransition[];
}) {
  const [state, action, pending] = useActionState(changeStatusAction.bind(null, slug, id), initial);
  const needsNote = transitions.filter((t) => t.requiresNote);
  return (
    <form action={action} className="space-y-4">
      <Result state={state} />
      <Field
        id="status-note"
        label="Note to resident (shown on the public tracking page)"
        optional={needsNote.length === 0}
        hint={
          needsNote.length > 0
            ? `Required for: ${[...new Set(needsNote.map((t) => t.label))].join(", ")}. Do not include personal or internal information.`
            : "Do not include personal or internal information."
        }
      >
        {(p) => <textarea {...p} name="note" rows={3} maxLength={2000} />}
      </Field>
      <div className="flex flex-wrap gap-2">
        {transitions.map((t, i) => (
          <Button
            key={t.to}
            type="submit"
            name="to"
            value={t.to}
            variant={i === 0 && !t.requiresNote ? "primary" : "secondary"}
            disabled={pending}
          >
            {t.label}
          </Button>
        ))}
      </div>
    </form>
  );
}

export function AssignForm({
  slug,
  id,
  staff,
  currentAssigneeId,
}: {
  slug: string;
  id: string;
  staff: AssignableStaff[];
  currentAssigneeId: string | null;
}) {
  const [state, action, pending] = useActionState(assignAction.bind(null, slug, id), initial);
  return (
    <form action={action} className="space-y-4">
      <Result state={state} />
      <Field
        id="assignee"
        label={currentAssigneeId ? "Reassign to" : "Assign to"}
        hint="Only staff who can work this department's requests are listed."
      >
        {(p) => (
          <select
            {...p}
            key={currentAssigneeId ?? "none"}
            name="assigneeUserId"
            defaultValue={currentAssigneeId ?? ""}
            required
          >
            <option value="" disabled>
              Choose a staff member
            </option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.title ? ` — ${s.title}` : ""}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        {currentAssigneeId ? "Reassign" : "Assign"}
      </Button>
    </form>
  );
}

export function CommentForm({
  slug,
  id,
  hasReporterEmail,
}: {
  slug: string;
  id: string;
  hasReporterEmail: boolean;
}) {
  const [state, action, pending] = useActionState(commentAction.bind(null, slug, id), initial);
  return (
    <form action={action} className="space-y-4">
      <Result state={state} />
      <fieldset>
        <legend className="text-sm font-medium text-ink">Who can see this?</legend>
        <div className="mt-2 space-y-2">
          <label className="flex min-h-11 items-start gap-3 rounded-lg border border-line px-3 py-2.5 text-sm">
            <input
              type="radio"
              name="visibility"
              value="internal"
              defaultChecked
              className="mt-0.5 size-4"
            />
            <span>
              <span className="font-medium">Internal note</span>
              <span className="block text-ink-muted">Staff only. Never shown to the resident.</span>
            </span>
          </label>
          <label className="flex min-h-11 items-start gap-3 rounded-lg border border-line px-3 py-2.5 text-sm">
            <input type="radio" name="visibility" value="public" className="mt-0.5 size-4" />
            <span>
              <span className="font-medium">Message to resident</span>
              <span className="block text-ink-muted">
                Shown on the public tracking page
                {hasReporterEmail
                  ? " and emailed to the resident"
                  : "; the resident left no email address"}
                .
              </span>
            </span>
          </label>
        </div>
      </fieldset>
      <Field id="comment-body" label="Note or message">
        {(p) => <textarea {...p} name="body" rows={3} maxLength={4000} required />}
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        Add
      </Button>
    </form>
  );
}
