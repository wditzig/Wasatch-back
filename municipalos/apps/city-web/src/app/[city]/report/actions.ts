"use server";

import { redirect } from "next/navigation";
import { createServiceRequestSchema } from "@municipalos/validation";
import { ApiError, api, fieldErrors } from "@/lib/api";
import type { CategorySuggestions, CreatedServiceRequest } from "@/lib/types";

export interface ReportFormState {
  errors: Record<string, string>;
  message?: string;
  values?: Record<string, string>;
}

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

export async function submitReport(
  city: string,
  _prev: ReportFormState,
  form: FormData,
): Promise<ReportFormState> {
  const values = Object.fromEntries(
    [
      "categoryId",
      "description",
      "locationText",
      "latitude",
      "longitude",
      "reporterName",
      "reporterEmail",
      "reporterPhone",
    ].map((k) => [k, text(form, k)]),
  );
  const lat = values.latitude ? Number(values.latitude) : undefined;
  const lng = values.longitude ? Number(values.longitude) : undefined;
  const parsed = createServiceRequestSchema.safeParse({
    ...values,
    latitude: Number.isFinite(lat) ? lat : undefined,
    longitude: Number.isFinite(lng) ? lng : undefined,
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      errors[key] ??= key === "categoryId" ? "Choose what kind of problem this is" : issue.message;
    }
    return { errors, values };
  }

  let created: CreatedServiceRequest;
  try {
    created = await api<CreatedServiceRequest>(
      `/v1/public/municipalities/${city}/service-requests`,
      {
        method: "POST",
        json: parsed.data,
        headers: { "idempotency-key": text(form, "idempotencyKey") || crypto.randomUUID() },
      },
    );
  } catch (err) {
    if (err instanceof ApiError) {
      const errors = fieldErrors(err);
      if (err.code === "contact_required") {
        errors.reporterName = "Enter your name";
        errors.reporterEmail = "Enter your email address";
      }
      return { errors, message: Object.keys(errors).length ? undefined : err.message, values };
    }
    throw err;
  }
  redirect(`/${city}/requests/${created.reference}?submitted=1`);
}

/** Advisory category suggestion and emergency-wording check for the text typed so far. */
export async function suggestForDescription(
  city: string,
  description: string,
): Promise<CategorySuggestions> {
  const empty: CategorySuggestions = { suggestions: [], possibleEmergency: false };
  if (description.trim().length < 3) return empty;
  try {
    return await api<CategorySuggestions>(
      `/v1/public/municipalities/${city}/service-categories/suggest`,
      {
        method: "POST",
        json: { description: description.slice(0, 2000) },
      },
    );
  } catch (err) {
    // Suggestions are optional; the form works without them.
    console.warn("[city-web] category suggestion unavailable", err);
    return empty;
  }
}
