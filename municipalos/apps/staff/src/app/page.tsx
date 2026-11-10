import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ChevronRight } from "lucide-react";
import { Button, Card, EmptyState } from "@municipalos/ui";
import { api } from "@/lib/api";
import { logoutAction } from "@/lib/session-actions";
import type { Me } from "@/lib/types";

export const metadata: Metadata = { title: "Choose a municipality" };

export default async function Home() {
  const me = await api<Me>("/v1/auth/me");
  const only = me.memberships.length === 1 ? me.memberships[0] : undefined;
  if (only) redirect(`/${only.municipality.slug}`);

  return (
    <main id="main" className="mx-auto max-w-lg px-6 py-16">
      <p className="text-sm font-semibold tracking-wide text-brand-700">MunicipalOS</p>
      {me.memberships.length === 0 ? (
        <>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">No municipal access</h1>
          <Card className="mt-6">
            <EmptyState
              icon={<Building2 className="size-8" />}
              title={`Signed in as ${me.user.email}`}
              description="Your account is not a staff member of any municipality. If you expected access, ask your municipal administrator to add you."
            />
          </Card>
        </>
      ) : (
        <>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Choose a municipality</h1>
          <p className="mt-1 text-sm text-ink-muted">
            You work for more than one municipality. Pick where to work now.
          </p>
          <ul className="mt-6 space-y-3">
            {me.memberships.map((m) => (
              <li key={m.municipality.slug}>
                <Link
                  href={`/${m.municipality.slug}`}
                  className="flex min-h-11 items-center justify-between rounded-card border border-line bg-surface px-5 py-4 hover:bg-slate-50"
                >
                  <span>
                    <span className="block font-medium">
                      {m.municipality.name}, {m.municipality.state}
                    </span>
                    {m.title ? (
                      <span className="block text-sm text-ink-muted">{m.title}</span>
                    ) : null}
                  </span>
                  <ChevronRight className="size-5 text-slate-500" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <form action={logoutAction} className="mt-8">
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
    </main>
  );
}
