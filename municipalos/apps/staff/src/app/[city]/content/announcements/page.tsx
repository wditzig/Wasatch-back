import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Megaphone } from "lucide-react";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  formatDateTime,
  type BadgeTone,
} from "@municipalos/ui";
import { api } from "@/lib/api";
import { base, getStaffMe } from "@/lib/staff";
import type { Announcement } from "../types";
import {
  CreateAnnouncementForm,
  EditAnnouncementForm,
  ExpireAnnouncementForm,
  PublishAnnouncementForm,
} from "./forms";

export const metadata: Metadata = { title: "Announcements" };

const STATUS: Record<Announcement["status"], { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  published: { label: "Published", tone: "green" },
  expired: { label: "Expired", tone: "neutral" },
};

export default async function AnnouncementsPage({ params }: { params: Promise<{ city: string }> }) {
  const me = await getStaffMe((await params).city);
  if (!me.permissions.includes("content.read")) notFound();
  const slug = me.municipality.slug;
  const canEdit = me.permissions.includes("content.edit");
  const canPublish = me.permissions.includes("content.publish");
  const tz = me.timezone;
  const { items } = await api<{ items: Announcement[] }>(`${base(slug)}/content/announcements`);

  return (
    <>
      <Link
        href={`/${slug}/content`}
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Website
      </Link>
      <PageHeader
        title="Announcements"
        description="Short notices on the website home page. An announcement is public only after it is published."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="min-w-0">
          {items.length === 0 ? (
            <EmptyState
              icon={<Megaphone className="size-8" />}
              title="No announcements yet"
              description="Announcements you create will be listed here."
            />
          ) : (
            <ul className="divide-y divide-line">
              {items.map((item) => {
                const editable = canEdit && (item.status === "draft" || canPublish);
                return (
                  <li key={item.id} className="space-y-3 px-5 py-4">
                    <div>
                      <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
                        {item.title}
                        <Badge tone={STATUS[item.status].tone}>{STATUS[item.status].label}</Badge>
                      </h2>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{item.body}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {item.publishedAt
                          ? `Published ${formatDateTime(item.publishedAt, tz)}`
                          : `Created ${formatDateTime(item.createdAt, tz)}`}
                        {item.expiresAt
                          ? ` · ${item.status === "expired" ? "Ended" : "Ends"} ${formatDateTime(item.expiresAt, tz)}`
                          : ""}
                      </p>
                    </div>
                    {item.status === "published" && canPublish ? (
                      <ExpireAnnouncementForm slug={slug} item={item} />
                    ) : null}
                    {item.status !== "published" && canPublish ? (
                      <details className="rounded-lg border border-line">
                        <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium text-ink">
                          {item.status === "expired" ? "Publish again" : "Publish"}
                          <span className="sr-only">: {item.title}</span>
                        </summary>
                        <div className="border-t border-line p-4">
                          <PublishAnnouncementForm slug={slug} item={item} timezone={tz} />
                        </div>
                      </details>
                    ) : null}
                    {editable ? (
                      <details className="rounded-lg border border-line">
                        <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium text-ink">
                          Edit<span className="sr-only">: {item.title}</span>
                        </summary>
                        <div className="border-t border-line p-4">
                          <EditAnnouncementForm slug={slug} item={item} />
                        </div>
                      </details>
                    ) : null}
                    {item.status === "draft" && !canPublish ? (
                      <p className="text-sm text-ink-muted">Waiting for a reviewer to publish.</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        {canEdit ? (
          <Card className="self-start">
            <CardHeader title="New announcement" />
            <div className="px-5 py-4">
              <CreateAnnouncementForm slug={slug} />
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
