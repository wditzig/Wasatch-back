import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Bell, ClipboardList, LayoutDashboard, LogOut, ScrollText } from "lucide-react";
import { Badge, Button, SkipLink } from "@municipalos/ui";
import { NavLink } from "@/components/nav-link";
import { logoutAction } from "@/lib/session-actions";
import { canSeeRequests, getStaffMe } from "@/lib/staff";

type Props = { params: Promise<{ city: string }>; children: ReactNode };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const me = await getStaffMe((await params).city);
  return {
    title: {
      default: me.municipality.name,
      template: `%s · ${me.municipality.name} · MunicipalOS Staff`,
    },
  };
}

export default async function CityLayout({ params, children }: Props) {
  const { city } = await params;
  const me = await getStaffMe(city);
  const root = `/${me.municipality.slug}`;

  return (
    <div className="min-h-screen md:flex">
      <SkipLink />
      <header className="border-b border-line bg-surface md:flex md:min-h-screen md:w-64 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
        <div className="px-5 pt-5 pb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            MunicipalOS
          </p>
          <p className="mt-0.5 text-lg font-semibold tracking-tight">
            {me.municipality.name}, {me.municipality.state}
          </p>
        </div>
        <nav aria-label="Main" className="px-3 pb-3 md:flex-1">
          <ul className="flex flex-wrap gap-1 md:flex-col">
            <li>
              <NavLink href={root} exact>
                <LayoutDashboard className="size-4" aria-hidden="true" />
                Dashboard
              </NavLink>
            </li>
            {canSeeRequests(me) ? (
              <li>
                <NavLink href={`${root}/requests`}>
                  <ClipboardList className="size-4" aria-hidden="true" />
                  Requests
                </NavLink>
              </li>
            ) : null}
            <li>
              <NavLink href={`${root}/notifications`}>
                <Bell className="size-4" aria-hidden="true" />
                Notifications
                {me.unreadNotifications > 0 ? (
                  <Badge tone="blue">
                    {me.unreadNotifications}
                    <span className="sr-only"> unread</span>
                  </Badge>
                ) : null}
              </NavLink>
            </li>
            {me.permissions.includes("audit.read") ? (
              <li>
                <NavLink href={`${root}/audit`}>
                  <ScrollText className="size-4" aria-hidden="true" />
                  Audit log
                </NavLink>
              </li>
            ) : null}
          </ul>
        </nav>
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 md:block">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{me.user.name}</p>
            <p className="truncate text-xs text-ink-muted">
              {me.membership.title ?? me.membership.roleName}
            </p>
            {me.membership.title ? (
              <p className="truncate text-xs text-ink-muted">{me.membership.roleName}</p>
            ) : null}
          </div>
          <form action={logoutAction} className="md:mt-3">
            <Button type="submit" variant="secondary" size="sm">
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
