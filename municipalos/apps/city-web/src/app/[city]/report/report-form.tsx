"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { LocateFixed, Send } from "lucide-react";
import { Alert, Button, Field, cn } from "@municipalos/ui";
import type { CategorySuggestions, ServiceCategory } from "@/lib/types";
import { submitReport, suggestForDescription, type ReportFormState } from "./actions";

interface Props {
  city: string;
  categories: ServiceCategory[];
  initialCategoryId: string;
  contactRequired: boolean;
}

const ERROR_ORDER = [
  "categoryId",
  "description",
  "locationText",
  "reporterName",
  "reporterEmail",
  "reporterPhone",
];
const ERROR_TARGET: Record<string, string> = { categoryId: "category-group" };

export function ReportForm({ city, categories, initialCategoryId, contactRequired }: Props) {
  const [state, formAction, pending] = useActionState<ReportFormState, FormData>(
    submitReport.bind(null, city),
    { errors: {} },
  );
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [description, setDescription] = useState("");
  const [hints, setHints] = useState<CategorySuggestions>({
    suggestions: [],
    possibleEmergency: false,
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState<"idle" | "working" | "failed">("idle");
  // Generated after mount (so server and client markup match) and kept for the life of the
  // form, so a double submit or a retry cannot create two requests.
  const [idempotencyKey, setIdempotencyKey] = useState("");
  useEffect(() => setIdempotencyKey(crypto.randomUUID()), []);
  const summaryRef = useRef<HTMLDivElement>(null);
  const uid = useId();

  const errors = state.errors;
  const errorKeys = ERROR_ORDER.filter((k) => errors[k]);

  // Move focus to the error summary after a failed submit so it is announced and visible.
  useEffect(() => {
    if (errorKeys.length > 0 || state.message) summaryRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Ask for a category suggestion shortly after the resident stops typing.
  useEffect(() => {
    if (description.trim().length < 12) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void suggestForDescription(city, description).then((result) => {
        if (!cancelled) setHints(result);
      });
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [city, description]);

  const suggestion = hints.suggestions.find((s) => s.categoryId !== categoryId);
  const showSuggestion = suggestion && hints.suggestions[0]?.categoryId !== categoryId;

  function useMyLocation() {
    if (!navigator.geolocation) return setLocating("failed");
    setLocating("working");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating("idle");
      },
      () => setLocating("failed"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <form action={formAction} noValidate className="space-y-8">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="latitude" value={coords?.lat ?? ""} />
      <input type="hidden" name="longitude" value={coords?.lng ?? ""} />

      {errorKeys.length > 0 || state.message ? (
        <div ref={summaryRef} tabIndex={-1} className="rounded-lg">
          <Alert
            tone="error"
            live
            title={state.message ?? "Please fix the following to send your request"}
          >
            {errorKeys.length > 0 ? (
              <ul className="list-disc space-y-0.5 pl-5">
                {errorKeys.map((k) => (
                  <li key={k}>
                    <a className="underline" href={`#${ERROR_TARGET[k] ?? k}`}>
                      {errors[k]}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </Alert>
        </div>
      ) : null}

      <fieldset
        id="category-group"
        aria-describedby={errors.categoryId ? `${uid}-cat-error` : undefined}
      >
        <legend className="text-base font-semibold text-ink">What kind of problem is it?</legend>
        {errors.categoryId ? (
          <p id={`${uid}-cat-error`} className="mt-1 text-sm font-medium text-red-800">
            {errors.categoryId}
          </p>
        ) : null}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {categories.map((c) => (
            <label
              key={c.id}
              className={cn(
                "flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border bg-surface px-4 py-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600",
                categoryId === c.id
                  ? "border-city ring-2 ring-city"
                  : "border-slate-300 hover:border-slate-500",
              )}
            >
              <input
                type="radio"
                name="categoryId"
                value={c.id}
                checked={categoryId === c.id}
                onChange={() => setCategoryId(c.id)}
                className="mt-1 size-4 accent-(--color-city) focus-visible:outline-none"
              />
              <span>
                <span className="block font-medium text-ink">{c.name}</span>
                <span className="block text-sm text-ink-muted">{c.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-3">
        <Field
          id="description"
          label="Describe the problem"
          hint="What is wrong, and anything that helps crews find it."
          error={errors.description}
        >
          {(p) => (
            <textarea
              {...p}
              name="description"
              rows={4}
              required
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>
        <div aria-live="polite" className="space-y-3">
          {hints.possibleEmergency ? (
            <Alert tone="warning" title="If this is an emergency, call 911 now.">
              This form is not monitored around the clock and does not dispatch emergency services.
            </Alert>
          ) : null}
          {showSuggestion ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-slate-50 px-4 py-3 text-sm">
              <span>
                This sounds like <strong>{suggestion.name}</strong>.
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCategoryId(suggestion.categoryId)}
              >
                Use {suggestion.name}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <Field
          id="locationText"
          label="Where is it?"
          hint="A street address, intersection or landmark."
          error={errors.locationText}
        >
          {(p) => (
            <input
              {...p}
              name="locationText"
              type="text"
              required
              maxLength={300}
              autoComplete="street-address"
              defaultValue={state.values?.locationText}
            />
          )}
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={useMyLocation} disabled={locating === "working"}>
            <LocateFixed className="size-4" aria-hidden="true" />
            {coords ? "Update my location" : "Add my current location"}
          </Button>
          <p role="status" className="text-sm text-ink-muted">
            {locating === "working" ? "Finding your location…" : null}
            {locating === "failed"
              ? "We couldn’t get your location. Please type the address instead."
              : null}
            {locating === "idle" && coords
              ? "Location attached. You can still type an address or landmark."
              : null}
          </p>
        </div>
      </div>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-ink">
          Your contact details{contactRequired ? "" : " (optional)"}
        </legend>
        <p className="!mt-1 text-sm text-ink-muted">
          {contactRequired
            ? "This city requires a name and email with each request."
            : "Add an email to get updates. You can also report without sharing who you are."}{" "}
          Contact details are only visible to city staff.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="reporterName"
            label="Name"
            optional={!contactRequired}
            error={errors.reporterName}
          >
            {(p) => (
              <input
                {...p}
                name="reporterName"
                type="text"
                autoComplete="name"
                maxLength={120}
                required={contactRequired}
                defaultValue={state.values?.reporterName}
              />
            )}
          </Field>
          <Field
            id="reporterEmail"
            label="Email"
            optional={!contactRequired}
            error={errors.reporterEmail}
          >
            {(p) => (
              <input
                {...p}
                name="reporterEmail"
                type="email"
                autoComplete="email"
                maxLength={254}
                required={contactRequired}
                defaultValue={state.values?.reporterEmail}
              />
            )}
          </Field>
        </div>
      </fieldset>

      <Button
        type="submit"
        variant="city"
        size="lg"
        aria-disabled={pending}
        onClick={(e) => pending && e.preventDefault()}
      >
        <Send className="size-5" aria-hidden="true" />
        {pending ? "Sending…" : "Send request"}
      </Button>
    </form>
  );
}
