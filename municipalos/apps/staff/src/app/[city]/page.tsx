import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Inbox, LayoutGrid } from "lucide-react";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Stat,
  StatusBadge,
  buttonClass,
} from "@municipalos/ui";
import { RequestList } from "@/components/request-list";
import { api } from "@/lib/api";
import { base, getStaffMe } from "@/lib/staff";
import type { Dashboard } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

function formatHours(hours: number | null): string {
  if (hours === null) return "—";
  return hours >= 48 ? `${Math.round((hours / 24) * 10) / 10} days` : `${hours} hr`;
}

export default async function DashboardPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const me = await getStaffMe(city);
  const slug = me.municipality.slug;
  const data = await api<Dashboard>(`${base(slug)}/dashboard`);
  const firstName = me.user.name.split(" ")[0];

  if (!data.hasRequestAccess || !data.metrics) {
    return (
      <>
        <PageHeader
          title={`Welcome, ${firstName}`}
          description={`${me.membership.roleName} · ${me.municipality.name}`}
        />
        <Card>
          <EmptyState
            icon={<LayoutGrid className="size-8" />}
            title="Nothing assigned to your role yet"
            description="Your role does not include any modules that are available today. Service requests are the only live module; your administrator can change your role if you need access."
          />
        </Card>
      </>
    );
  }

  const m = data.metrics;
  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName}`}
        description={`${me.membership.roleName} · ${me.municipality.name}`}
        actions={
          <Link href={`/${slug}/requests`} className={buttonClass("secondary")}>
            All requests
          </Link>
        }
      />

      <section aria-label="Key figures" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Open requests" value={m.open} />
        <Stat label="Received" value={m.receivedLast7Days} hint="Last 7 days" />
        <Stat label="Resolved" value={m.resolvedLast30Days} hint="Last 30 days" />
        <Stat
          label="Average time to resolve"
          value={formatHours(m.avgHoursToResolveLast30Days)}
          hint="Last 30 days"
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Assigned to me"
            description="Open requests you are responsible for, oldest first."
          />
          {data.myQueue.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="size-8" />}
              title="You're all caught up"
              description="No open requests are assigned to you."
            />
          ) : (
            <RequestList slug={slug} items={data.myQueue} />
          )}
        </Card>
        <Card>
          <CardHeader
            title="Needs triage"
            description="New and reviewed requests waiting to be assigned."
          />
          {data.needsTriage.length === 0 ? (
            <EmptyState
              icon={<Inbox className="size-8" />}
              title="Nothing waiting"
              description="Every incoming request has been assigned."
            />
          ) : (
            <RequestList slug={slug} items={data.needsTriage} />
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Requests by status"
          description="Select a status to see the matching requests."
        />
        <ul className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-6">
          {data.statusCounts.map((s) => (
            <li key={s.status} className="bg-surface">
              <Link
                href={`/${slug}/requests?status=${s.status}`}
                className="flex min-h-11 flex-col gap-2 px-5 py-4 hover:bg-slate-50"
              >
                <span className="text-2xl font-semibold tracking-tight">{s.count}</span>
                <span>
                  <StatusBadge status={s.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
