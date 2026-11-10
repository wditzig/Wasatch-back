import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import { Card, EmptyState, SkipLink } from "@municipalos/ui";
import { api } from "@/lib/api";
import type { MunicipalitySummary } from "@/lib/types";

export const metadata = { title: "Choose your city · MunicipalOS" };

export default async function ChooseCityPage() {
  const { items } = await api<{ items: MunicipalitySummary[] }>("/v1/public/municipalities");
  return (
    <>
      <SkipLink />
      <main id="main" className="mx-auto max-w-2xl px-4 py-16 sm:py-24">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">MunicipalOS</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Choose your city
        </h1>
        <p className="mt-3 text-lg text-ink-muted">
          Report a problem, track a request and find city services.
        </p>

        {items.length === 0 ? (
          <Card className="mt-8">
            <EmptyState title="No cities are available yet" description="Check back soon." />
          </Card>
        ) : (
          <ul className="mt-8 space-y-3">
            {items.map((m) => (
              <li key={m.slug}>
                <Link
                  href={`/${m.slug}`}
                  className="flex min-h-16 items-center gap-4 rounded-card border border-line bg-surface px-5 py-4 shadow-xs hover:border-brand-500"
                >
                  <Building2 className="size-6 shrink-0 text-brand-600" aria-hidden="true" />
                  <span className="flex-1">
                    <span className="block text-lg font-medium text-ink">{m.name}</span>
                    <span className="block text-sm text-ink-muted">{m.state}</span>
                  </span>
                  <ArrowRight className="size-5 text-slate-500" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 text-sm text-ink-muted">
          Don&rsquo;t see your city? Online services here are only available for cities that use
          MunicipalOS. Please contact your city hall directly.
        </p>
      </main>
    </>
  );
}
