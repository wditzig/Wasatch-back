import type { Metadata } from "next";
import Link from "next/link";
import { BellOff } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader, formatRelative } from "@municipalos/ui";
import { api } from "@/lib/api";
import { base, getStaffMe } from "@/lib/staff";
import type { StaffNotification } from "@/lib/types";
import { markReadAction } from "./actions";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const me = await getStaffMe(city);
  const slug = me.municipality.slug;
  const { items } = await api<{ items: StaffNotification[] }>(`${base(slug)}/notifications`);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Your 30 most recent notifications."
        actions={
          unread > 0 ? (
            <form action={markReadAction.bind(null, slug, null)}>
              <Button type="submit" variant="secondary">
                Mark all as read
              </Button>
            </form>
          ) : undefined
        }
      />
      <Card>
        {items.length === 0 ? (
          <EmptyState
            icon={<BellOff className="size-8" />}
            title="No notifications yet"
            description="You'll be notified when requests reach your department or are assigned to you."
          />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {n.entityType === "service_request" && n.entityId ? (
                      <Link
                        href={`/${slug}/requests/${n.entityId}`}
                        className="text-brand-700 underline underline-offset-2 hover:text-brand-800"
                      >
                        {n.subject}
                      </Link>
                    ) : (
                      n.subject
                    )}
                    {!n.readAt ? <Badge tone="blue">Unread</Badge> : null}
                  </p>
                  {n.body ? <p className="mt-0.5 text-sm text-ink-muted">{n.body}</p> : null}
                  <p className="mt-0.5 text-xs text-ink-muted">{formatRelative(n.createdAt)}</p>
                </div>
                {!n.readAt ? (
                  <form action={markReadAction.bind(null, slug, n.id)}>
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      aria-label={`Mark as read: ${n.subject}`}
                    >
                      Mark as read
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
