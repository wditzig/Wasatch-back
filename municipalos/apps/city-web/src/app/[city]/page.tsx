import Link from "next/link";
import { ArrowRight, ClipboardList, Megaphone, Search, Users } from "lucide-react";
import { Card, CardHeader, EmptyState, buttonClass, formatDate } from "@municipalos/ui";
import { getSite } from "@/lib/api";

export default async function CityHomePage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const site = await getSite(city);
  const requestsEnabled = site.modules.includes("service_requests");

  const actions = [
    ...(requestsEnabled
      ? [
          {
            href: `/${city}/report`,
            title: "Report a problem",
            text: "Potholes, streetlights, signs, parks and more.",
            icon: ClipboardList,
          },
          {
            href: `/${city}/requests`,
            title: "Track a request",
            text: "Check progress with your tracking number.",
            icon: Search,
          },
        ]
      : []),
    {
      href: `/${city}/departments`,
      title: "Contact a department",
      text: "Phone numbers and email for city offices.",
      icon: Users,
    },
  ];

  return (
    <div className="space-y-10">
      <section aria-labelledby="welcome">
        <h1 id="welcome" className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Welcome to {site.municipality.name}
        </h1>
        {site.branding.tagline ? (
          <p className="mt-2 text-lg text-ink-muted">{site.branding.tagline}</p>
        ) : null}
        {requestsEnabled ? (
          <Link href={`/${city}/report`} className={buttonClass("city", "lg", "mt-6")}>
            Report a problem <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
        ) : null}
      </section>

      <section aria-labelledby="quick">
        <h2 id="quick" className="text-xl font-semibold text-ink">
          How can we help?
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          {actions.map((a) => (
            <li key={a.href}>
              <Link
                href={a.href}
                className="block h-full rounded-card border border-line bg-surface p-5 shadow-xs hover:border-city"
              >
                <a.icon className="size-6 text-city" aria-hidden="true" />
                <span className="mt-3 block font-semibold text-ink">{a.title}</span>
                <span className="mt-1 block text-sm text-ink-muted">{a.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="news">
        <Card>
          <CardHeader title={<span id="news">News and announcements</span>} />
          {site.announcements.length === 0 ? (
            <EmptyState
              icon={<Megaphone className="size-8" />}
              title="No announcements right now"
              description="New city announcements will appear here."
            />
          ) : (
            <ul className="divide-y divide-line">
              {site.announcements.map((a) => (
                <li key={a.id} className="px-5 py-4">
                  <h3 className="font-medium text-ink">{a.title}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{a.body}</p>
                  <p className="mt-2 text-xs text-ink-muted">
                    <time dateTime={a.publishedAt}>{formatDate(a.publishedAt, site.timezone)}</time>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
