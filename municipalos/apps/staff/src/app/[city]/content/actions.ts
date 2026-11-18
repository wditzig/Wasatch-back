"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CONTENT_BLOCK_TYPES,
  announcementSchema,
  createPageSchema,
  requestChangesSchema,
  saveDraftSchema,
} from "@municipalos/validation";
import { ApiError, actionError, api } from "@/lib/api";
import { base, getStaffMe } from "@/lib/staff";
import { BLOCK_LABELS } from "./block-labels";
import { zonedLocalToUtc } from "./datetime";
import type { ContentActionState } from "./types";

type State = ContentActionState;

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function refresh(slug: string, id?: string) {
  revalidatePath(`/${slug}/content`);
  if (id) revalidatePath(`/${slug}/content/${id}`);
  revalidatePath(`/${slug}`, "layout");
}

function fail(err: unknown): State {
  if (err instanceof ApiError) {
    const issues = (err.details as { issues?: { path: string; message: string }[] } | undefined)
      ?.issues;
    return { error: err.message, problems: issues?.map((i) => i.message) };
  }
  return actionError(err);
}

/** Reads an optional `datetime-local` field as an instant in the municipality's time zone. */
async function optionalInstant(
  slug: string,
  value: string,
): Promise<{ iso?: string; error?: string }> {
  if (!value) return {};
  const { timezone } = await getStaffMe(slug);
  const instant = zonedLocalToUtc(value, timezone);
  if (!instant) return { error: "Enter a valid date and time." };
  if (instant.getTime() <= Date.now()) return { error: "Choose a date and time in the future." };
  return { iso: instant.toISOString() };
}

export async function createPageAction(slug: string, _prev: State, form: FormData): Promise<State> {
  const parsed = createPageSchema.safeParse({
    title: text(form, "title"),
    slug: text(form, "slug").toLowerCase(),
  });
  if (!parsed.success) {
    return {
      error: "Check the page details.",
      problems: parsed.error.issues.map((i) =>
        i.path[0] === "slug"
          ? "Web address: use lowercase letters, numbers and hyphens, for example “leaf-collection”."
          : i.message,
      ),
    };
  }
  let created: { id: string };
  try {
    created = await api<{ id: string }>(`${base(slug)}/content/pages`, {
      method: "POST",
      json: parsed.data,
    });
  } catch (err) {
    return fail(err);
  }
  refresh(slug);
  redirect(`/${slug}/content/${created.id}`);
}

export async function saveDraftAction(
  slug: string,
  id: string,
  _prev: State,
  form: FormData,
): Promise<State> {
  let blocks: unknown;
  try {
    blocks = JSON.parse(String(form.get("blocks") ?? "[]"));
  } catch {
    return { error: "The page content could not be read. Reload and try again." };
  }
  const versionField = text(form, "expectedVersion");
  const parsed = saveDraftSchema.safeParse({
    title: text(form, "title"),
    blocks,
    expectedVersion: versionField ? Number(versionField) : null,
  });
  if (!parsed.success) {
    const list = Array.isArray(blocks) ? (blocks as { type?: string }[]) : [];
    const problems = parsed.error.issues.map((issue) => {
      if (issue.path[0] === "title") return `Page title: ${issue.message}`;
      if (issue.path[0] === "blocks" && typeof issue.path[1] === "number") {
        const type = list[issue.path[1]]?.type;
        const label = (CONTENT_BLOCK_TYPES as readonly string[]).includes(type ?? "")
          ? BLOCK_LABELS[type as keyof typeof BLOCK_LABELS]
          : "Block";
        const required = issue.code === "too_small" || issue.code === "invalid_type";
        return `Block ${issue.path[1] + 1} (${label}): ${required ? "fill in the required fields" : issue.message}`;
      }
      return issue.message;
    });
    return {
      error: "The page was not saved. Please fix the following:",
      problems: [...new Set(problems)],
    };
  }
  try {
    const saved = await api<{ version: number }>(`${base(slug)}/content/pages/${id}/draft`, {
      method: "PUT",
      json: parsed.data,
    });
    refresh(slug, id);
    return {
      success: "Draft saved. It is not public until it is reviewed and published.",
      version: saved.version,
    };
  } catch (err) {
    return fail(err);
  }
}

async function post(
  slug: string,
  id: string,
  path: string,
  json: unknown,
  success: string,
): Promise<State> {
  try {
    await api(`${base(slug)}/content/pages/${id}/${path}`, { method: "POST", json });
  } catch (err) {
    return fail(err);
  }
  refresh(slug, id);
  return { success };
}

export async function submitAction(slug: string, id: string): Promise<State> {
  return post(slug, id, "submit", undefined, "Submitted for review. Reviewers have been notified.");
}

export async function publishAction(
  slug: string,
  id: string,
  _prev: State,
  form: FormData,
): Promise<State> {
  const when = await optionalInstant(slug, text(form, "publishAtLocal"));
  if (when.error) return { error: when.error };
  return post(
    slug,
    id,
    "publish",
    { publishAt: when.iso },
    when.iso
      ? "Approved. The page will be published at the scheduled time."
      : "Approved and published.",
  );
}

export async function requestChangesAction(
  slug: string,
  id: string,
  _prev: State,
  form: FormData,
): Promise<State> {
  const parsed = requestChangesSchema.safeParse({ note: text(form, "note") });
  if (!parsed.success) return { error: "Explain what needs to change." };
  return post(slug, id, "request-changes", parsed.data, "Sent back to the author with your note.");
}

export async function archiveAction(slug: string, id: string): Promise<State> {
  return post(
    slug,
    id,
    "archive",
    undefined,
    "Archived. The page is no longer on the public website.",
  );
}

export async function restoreAction(slug: string, id: string): Promise<State> {
  return post(
    slug,
    id,
    "restore",
    undefined,
    "Restored as a draft. It must be reviewed before it is public again.",
  );
}

export async function navigationAction(
  slug: string,
  id: string,
  _prev: State,
  form: FormData,
): Promise<State> {
  const navOrder = Number(text(form, "navOrder") || "0");
  if (!Number.isInteger(navOrder) || navOrder < 0 || navOrder > 999)
    return { error: "Position must be a whole number from 0 to 999." };
  try {
    await api(`${base(slug)}/content/pages/${id}/navigation`, {
      method: "PUT",
      json: { showInNav: form.get("showInNav") === "on", navOrder },
    });
  } catch (err) {
    return fail(err);
  }
  refresh(slug, id);
  return { success: "Navigation settings saved." };
}

/* ───────────── Announcements ───────────── */

function parseAnnouncement(form: FormData) {
  return announcementSchema.safeParse({ title: text(form, "title"), body: text(form, "body") });
}

export async function createAnnouncementAction(
  slug: string,
  _prev: State,
  form: FormData,
): Promise<State> {
  const parsed = parseAnnouncement(form);
  if (!parsed.success)
    return {
      error: "Check the announcement.",
      problems: parsed.error.issues.map((i) => i.message),
    };
  try {
    await api(`${base(slug)}/content/announcements`, { method: "POST", json: parsed.data });
  } catch (err) {
    return fail(err);
  }
  refresh(slug);
  revalidatePath(`/${slug}/content/announcements`);
  return { success: "Draft announcement created. It is not public until it is published." };
}

export async function updateAnnouncementAction(
  slug: string,
  id: string,
  _prev: State,
  form: FormData,
): Promise<State> {
  const parsed = parseAnnouncement(form);
  if (!parsed.success)
    return {
      error: "Check the announcement.",
      problems: parsed.error.issues.map((i) => i.message),
    };
  try {
    await api(`${base(slug)}/content/announcements/${id}`, { method: "PUT", json: parsed.data });
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/${slug}/content/announcements`);
  return { success: "Announcement saved." };
}

export async function publishAnnouncementAction(
  slug: string,
  id: string,
  _prev: State,
  form: FormData,
): Promise<State> {
  const until = await optionalInstant(slug, text(form, "expiresAtLocal"));
  if (until.error) return { error: until.error };
  try {
    await api(`${base(slug)}/content/announcements/${id}/publish`, {
      method: "POST",
      json: { expiresAt: until.iso },
    });
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/${slug}/content/announcements`);
  return { success: "Published on the website home page." };
}

export async function expireAnnouncementAction(slug: string, id: string): Promise<State> {
  try {
    await api(`${base(slug)}/content/announcements/${id}/expire`, { method: "POST" });
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/${slug}/content/announcements`);
  return { success: "Removed from the website." };
}
