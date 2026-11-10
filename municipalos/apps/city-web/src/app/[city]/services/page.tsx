import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Alert } from "@municipalos/ui";
import { getCategories, requireServiceRequests } from "@/lib/services";

export const metadata = { title: "Services" };

export default async function ServicesPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  await requireServiceRequests(city);
  const categories = await getCategories(city);
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">City services</h1>
      <p className="mt-2 text-ink-muted">Choose the kind of problem you want to report.</p>
      <Alert tone="warning" title="For emergencies, call 911." className="mt-6">
        Online requests are reviewed during business hours.
      </Alert>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {categories.map((c) => (
          <li key={c.id}>
            <Link
              href={`/${city}/report?category=${c.slug}`}
              className="flex h-full items-center gap-4 rounded-card border border-line bg-surface p-5 shadow-xs hover:border-city"
            >
              <span className="flex-1">
                <span className="block font-semibold text-ink">{c.name}</span>
                <span className="mt-0.5 block text-sm text-ink-muted">{c.description}</span>
                <span className="mt-2 block text-xs text-ink-muted">
                  Handled by {c.departmentName}
                </span>
              </span>
              <ArrowRight className="size-5 shrink-0 text-slate-500" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
