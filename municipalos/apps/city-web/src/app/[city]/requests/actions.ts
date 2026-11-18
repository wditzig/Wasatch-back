"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { referenceSchema, residentMessageSchema } from "@municipalos/validation";
import { ApiError, api, apiUpload, photoProblem } from "@/lib/api";

export interface SimpleFormState {
  error?: string;
  ok?: boolean;
  value?: string;
}

export async function lookupRequest(
  city: string,
  _prev: SimpleFormState,
  form: FormData,
): Promise<SimpleFormState> {
  const value = String(form.get("reference") ?? "");
  const parsed = referenceSchema.safeParse(value);
  if (!parsed.success) {
    return {
      value,
      error:
        "Enter your tracking number exactly as shown on your confirmation, for example CR-7K3M9Q2X.",
    };
  }
  try {
    await api(`/v1/public/municipalities/${city}/service-requests/${parsed.data}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return {
        value,
        error:
          "We couldn’t find a request with that tracking number. Check the number and try again.",
      };
    }
    if (err instanceof ApiError) return { value, error: err.message };
    throw err;
  }
  redirect(`/${city}/requests/${parsed.data}`);
}

export async function addMessage(
  city: string,
  reference: string,
  _prev: SimpleFormState,
  form: FormData,
): Promise<SimpleFormState> {
  const value = String(form.get("body") ?? "");
  const parsed = residentMessageSchema.safeParse({ body: value });
  if (!parsed.success) return { value, error: "Enter a message of at least 2 characters." };
  try {
    await api(`/v1/public/municipalities/${city}/service-requests/${reference}/messages`, {
      method: "POST",
      json: parsed.data,
    });
  } catch (err) {
    if (err instanceof ApiError) return { value, error: err.message };
    throw err;
  }
  revalidatePath(`/${city}/requests/${reference}`);
  return { ok: true };
}

export async function addPhoto(
  city: string,
  reference: string,
  existing: number,
  _prev: SimpleFormState,
  form: FormData,
): Promise<SimpleFormState> {
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo to add." };
  const problem = photoProblem([file], existing);
  if (problem) return { error: problem };
  try {
    await apiUpload(
      `/v1/public/municipalities/${city}/service-requests/${reference}/attachments`,
      file,
    );
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }
  revalidatePath(`/${city}/requests/${reference}`);
  return { ok: true };
}
