import { Mail, Phone } from "lucide-react";
import { Card } from "@municipalos/ui";
import { getSite } from "@/lib/api";

export const metadata = { title: "Departments" };

export default async function DepartmentsPage({ params }: { params: Promise<{ city: string }> }) {
  const site = await getSite((await params).city);
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Departments</h1>
      <p className="mt-2 text-ink-muted">Contact the office that handles what you need.</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {site.departments.map((d) => (
          <li key={d.slug}>
            <Card className="h-full p-5">
              <h2 className="text-lg font-semibold text-ink">{d.name}</h2>
              <p className="mt-1 text-sm text-ink-muted">{d.description}</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {d.phone ? (
                  <li className="flex items-center gap-2">
                    <Phone className="size-4 text-ink-muted" aria-hidden="true" />
                    <a className="underline" href={`tel:${d.phone.replace(/[^0-9+]/g, "")}`}>
                      {d.phone}
                    </a>
                  </li>
                ) : null}
                {d.email ? (
                  <li className="flex items-center gap-2">
                    <Mail className="size-4 text-ink-muted" aria-hidden="true" />
                    <a className="underline" href={`mailto:${d.email}`}>
                      {d.email}
                    </a>
                  </li>
                ) : null}
              </ul>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
