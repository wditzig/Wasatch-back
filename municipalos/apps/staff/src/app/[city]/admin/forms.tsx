"use client";

import { useActionState } from "react";
import { Alert, Button, Field } from "@municipalos/ui";
import {
  createCategoryAction,
  dispositionAction,
  placeHoldAction,
  releaseHoldAction,
  updateRetentionAction,
  updateCategoryAction,
  updateMembershipAction,
  updateSettingsAction,
} from "./actions";
import type {
  AdminCategory,
  AdminFormState,
  Department,
  DispositionReview,
  LegalHold,
  RetentionPolicy,
  MunicipalSettings,
  Role,
  StaffMember,
} from "./types";

const initial: AdminFormState = {};

function Result({ state }: { state: AdminFormState }) {
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

function Checkbox({
  id,
  name,
  label,
  hint,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-1 size-5"
      />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {hint ? (
          <p id={`${id}-hint`} className="text-sm text-ink-muted">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CategoryFields({
  departments,
  category,
  errors,
}: {
  departments: Department[];
  category?: AdminCategory;
  errors?: Record<string, string>;
}) {
  const p = category ? `edit` : `new`;
  return (
    <>
      <Field
        id={`${p}-name`}
        label="Name"
        hint="What residents see, for example “Pothole”."
        error={errors?.name}
      >
        {(f) => (
          <input
            {...f}
            name="name"
            type="text"
            required
            maxLength={80}
            defaultValue={category?.name}
          />
        )}
      </Field>
      <Field id={`${p}-description`} label="Description" optional error={errors?.description}>
        {(f) => (
          <input
            {...f}
            name="description"
            type="text"
            maxLength={300}
            defaultValue={category?.description}
          />
        )}
      </Field>
      <Field
        id={`${p}-department`}
        label="Responsible department"
        hint="New requests in this category are routed here."
        error={errors?.departmentId}
      >
        {(f) => (
          <select {...f} name="departmentId" required defaultValue={category?.departmentId ?? ""}>
            <option value="" disabled>
              Choose a department
            </option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field
        id={`${p}-keywords`}
        label="Suggestion keywords"
        optional
        hint="Separate with commas. When a resident's description contains one, this category is suggested."
        error={errors?.keywords ?? errors?.[0]}
      >
        {(f) => (
          <input {...f} name="keywords" type="text" defaultValue={category?.keywords.join(", ")} />
        )}
      </Field>
    </>
  );
}

export function CreateCategoryForm({
  slug,
  departments,
}: {
  slug: string;
  departments: Department[];
}) {
  const [state, action, pending] = useActionState(createCategoryAction.bind(null, slug), initial);
  return (
    <form action={action} className="space-y-4" key={state.success ?? "new"}>
      <Result state={state} />
      <CategoryFields departments={departments} errors={state.fieldErrors} />
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add category"}
      </Button>
    </form>
  );
}

export function EditCategoryForm({
  slug,
  category,
  departments,
}: {
  slug: string;
  category: AdminCategory;
  departments: Department[];
}) {
  const [state, action, pending] = useActionState(
    updateCategoryAction.bind(null, slug, category.id),
    initial,
  );
  return (
    <form action={action} className="space-y-4">
      <Result state={state} />
      <CategoryFields departments={departments} category={category} errors={state.fieldErrors} />
      <Checkbox
        id="isActive"
        name="isActive"
        label="Active"
        hint="Inactive categories are hidden from residents. Existing requests are not affected."
        defaultChecked={category.isActive}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save category"}
      </Button>
    </form>
  );
}

export function SettingsForm({ slug, settings }: { slug: string; settings: MunicipalSettings }) {
  const [state, action, pending] = useActionState(updateSettingsAction.bind(null, slug), initial);
  const e = state.fieldErrors;
  return (
    <form action={action} className="space-y-8">
      <Result state={state} />
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-ink">Branding</legend>
        <Field
          id="primaryColor"
          label="Brand colour"
          hint="Used for the website header and buttons. Colours that would be hard to read are darkened automatically."
          error={e?.primaryColor}
        >
          {(f) => (
            <input
              {...f}
              name="primaryColor"
              type="color"
              defaultValue={settings.branding.primaryColor}
              className="h-11 w-24 rounded-lg border border-slate-400 bg-white p-1"
            />
          )}
        </Field>
        <Field id="tagline" label="Tagline" optional error={e?.tagline}>
          {(f) => (
            <input
              {...f}
              name="tagline"
              type="text"
              maxLength={120}
              defaultValue={settings.branding.tagline}
            />
          )}
        </Field>
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-ink">City Hall contact details</legend>
        <Field id="address" label="Address" error={e?.address}>
          {(f) => (
            <input
              {...f}
              name="address"
              type="text"
              required
              maxLength={200}
              defaultValue={settings.contact.address}
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="phone" label="Phone" error={e?.phone}>
            {(f) => (
              <input
                {...f}
                name="phone"
                type="tel"
                required
                maxLength={30}
                defaultValue={settings.contact.phone}
              />
            )}
          </Field>
          <Field id="email" label="Email" error={e?.email}>
            {(f) => (
              <input
                {...f}
                name="email"
                type="email"
                required
                maxLength={254}
                defaultValue={settings.contact.email}
              />
            )}
          </Field>
        </div>
        <Field id="hours" label="Office hours" error={e?.hours}>
          {(f) => (
            <input
              {...f}
              name="hours"
              type="text"
              required
              maxLength={120}
              defaultValue={settings.contact.hours}
            />
          )}
        </Field>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-base font-semibold text-ink">Reporting policy</legend>
        <Checkbox
          id="allowAnonymousRequests"
          name="allowAnonymousRequests"
          label="Allow residents to report problems without giving their name and email"
          hint="When off, a name and email are required with every request."
          defaultChecked={settings.allowAnonymousRequests}
        />
      </fieldset>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}

export function MembershipForm({
  slug,
  member,
  roles,
  departments,
}: {
  slug: string;
  member: StaffMember;
  roles: Role[];
  departments: Department[];
}) {
  const [state, action, pending] = useActionState(
    updateMembershipAction.bind(null, slug, member.membershipId),
    initial,
  );
  const e = state.fieldErrors;
  return (
    <form action={action} className="space-y-4">
      <Result state={state} />
      <Field id="title" label="Job title" optional error={e?.title}>
        {(f) => (
          <input
            {...f}
            name="title"
            type="text"
            maxLength={120}
            defaultValue={member.title ?? ""}
          />
        )}
      </Field>
      <Field
        id="roleId"
        label="Role"
        hint="The role decides what this person can see and do. See the role reference on the staff page."
        error={e?.roleId}
      >
        {(f) => (
          <select {...f} name="roleId" required defaultValue={member.roleId}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field
        id="departmentId"
        label="Department"
        hint="Department roles only see their own department's requests."
        error={e?.departmentId}
      >
        {(f) => (
          <select {...f} name="departmentId" defaultValue={member.departmentId ?? ""}>
            <option value="">No department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Checkbox
        id="suspended"
        name="suspended"
        label="Suspend access"
        hint="Takes effect immediately. Their history and assignments are kept."
        defaultChecked={member.status === "suspended"}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save access"}
      </Button>
    </form>
  );
}

export function RetentionForm({ slug, policy }: { slug: string; policy: RetentionPolicy }) {
  const [state, action, pending] = useActionState(updateRetentionAction.bind(null, slug), initial);
  const e = state.fieldErrors;
  const years = policy.retentionDays ? Math.max(1, Math.round(policy.retentionDays / 365)) : "";
  return (
    <form action={action} className="space-y-4">
      <Result state={state} />
      <Field
        id="years"
        label="Keep closed service requests for (years)"
        hint="Counted from the day a request is closed. Use the period in your records retention schedule."
        error={e?.years ?? e?.retentionDays}
      >
        {(f) => (
          <input
            {...f}
            name="years"
            type="number"
            min={1}
            max={100}
            step={1}
            defaultValue={years}
            className={`${f.className} max-w-40`}
          />
        )}
      </Field>
      <Checkbox
        id="permanent"
        name="permanent"
        label="Keep permanently"
        hint="No record of this type will be listed for disposition."
        defaultChecked={policy.retentionDays === null}
      />
      <Field
        id="authority"
        label="Legal authority"
        hint="The schedule item or statute this period comes from. It is recorded with every disposition."
        error={e?.authority}
      >
        {(f) => (
          <input
            {...f}
            name="authority"
            type="text"
            required
            maxLength={300}
            defaultValue={policy.authority ?? ""}
          />
        )}
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save schedule"}
      </Button>
    </form>
  );
}

export function DispositionForm({
  slug,
  review,
  dates,
}: {
  slug: string;
  review: DispositionReview;
  dates: Record<string, string>;
}) {
  const [state, action, pending] = useActionState(dispositionAction.bind(null, slug), initial);
  return (
    <form action={action} className="space-y-4">
      <Result state={state} />
      <fieldset>
        <legend className="text-sm font-medium text-ink">
          Records past their retention period
        </legend>
        <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
          {review.eligible.map((r) => (
            <li key={r.id} className="flex items-start gap-3 px-4 py-3">
              <input
                id={`rec-${r.id}`}
                type="checkbox"
                name="requestIds"
                value={r.id}
                className="mt-1 size-5"
              />
              <label htmlFor={`rec-${r.id}`} className="text-sm">
                <span className="font-medium text-ink">{r.reference}</span> · {r.categoryName}
                <span className="block text-ink-muted">Closed {dates[r.id]}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <Alert tone="warning" title="This cannot be undone.">
        The reporter&rsquo;s name, email and phone number are permanently removed from the selected
        records. The request, its status history and the audit trail are kept.
      </Alert>
      <Checkbox
        id="confirm"
        name="confirm"
        label="I am authorized to disposition these records under the city's retention schedule"
      />
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? "Working…" : "Disposition selected records"}
      </Button>
    </form>
  );
}

export function PlaceHoldForm({ slug, requestId }: { slug: string; requestId: string }) {
  const [state, action, pending] = useActionState(
    placeHoldAction.bind(null, slug, requestId),
    initial,
  );
  return (
    <form action={action} className="space-y-3" key={state.success ?? "hold"}>
      <Result state={state} />
      <Field
        id="hold-reason"
        label="Reason for the hold"
        hint="For example the claim, audit or public records request. Staff only."
        error={state.fieldErrors?.reason}
      >
        {(f) => <textarea {...f} name="reason" rows={2} required maxLength={500} />}
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Placing…" : "Place legal hold"}
      </Button>
    </form>
  );
}

export function ReleaseHoldForm({
  slug,
  requestId,
  hold,
}: {
  slug: string;
  requestId: string;
  hold: LegalHold;
}) {
  const [state, action, pending] = useActionState(
    releaseHoldAction.bind(null, slug, requestId, hold.id),
    initial,
  );
  return (
    <form action={action} className="mt-2 space-y-3">
      <Result state={state} />
      <Field
        id={`release-${hold.id}`}
        label="Release note"
        hint="Why the hold is no longer needed."
        error={state.fieldErrors?.note}
      >
        {(f) => <input {...f} name="note" type="text" required maxLength={500} />}
      </Field>
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Releasing…" : "Release hold"}
      </Button>
    </form>
  );
}
