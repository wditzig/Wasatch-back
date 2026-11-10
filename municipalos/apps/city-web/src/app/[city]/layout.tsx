import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { SkipLink, cityColors } from "@municipalos/ui";
import { getSite } from "@/lib/api";

type Props = { children: React.ReactNode; params: Promise<{ city: string }> };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const site = await getSite((await params).city);
  const name = `${site.municipality.name}, ${site.municipality.state}`;
  return {
    title: { default: name, template: `%s | ${site.municipality.name}` },
    description: `Official online services for ${name}: report a problem, track a request and contact city departments.`,
  };
}

export default async function CityLayout({ children, params }: Props) {
  const { city } = await params;
  const site = await getSite(city);
  const colors = cityColors(site.branding.primaryColor);
  const requestsEnabled = site.modules.includes("service_requests");
  const nav = [
    { href: `/${city}`, label: "Home" },
    ...(requestsEnabled
      ? [
          { href: `/${city}/services`, label: "Services" },
          { href: `/${city}/report`, label: "Report a problem" },
          { href: `/${city}/requests`, label: "Track a request" },
        ]
      : []),
    { href: `/${city}/departments`, label: "Departments" },
  ];
  const style = {
    "--color-city": colors.primary,
    "--color-on-city": colors.onPrimary,
  } as CSSProperties;

  return (
    <div style={style} className="flex min-h-screen flex-col">
      <SkipLink />
      <header className="bg-city text-on-city">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-4 py-4">
          <Link href={`/${city}`} className="text-xl font-semibold tracking-tight">
            {site.municipality.name}
            <span className="ml-2 text-sm font-normal opacity-90">{site.municipality.state}</span>
          </Link>
          <nav aria-label="Main">
            <ul className="-mx-2 flex flex-wrap gap-x-1 text-sm font-medium">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex min-h-11 items-center rounded-lg px-3 hover:underline hover:underline-offset-4"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-10">
        {children}
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 text-sm text-ink-muted sm:grid-cols-2">
          <div>
            <h2 className="font-semibold text-ink">{site.municipality.name} City Hall</h2>
            <ul className="mt-2 space-y-1.5">
              <li className="flex gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {site.contact.address}
              </li>
              <li className="flex gap-2">
                <Phone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <a className="underline" href={`tel:${site.contact.phone.replace(/[^0-9+]/g, "")}`}>
                  {site.contact.phone}
                </a>
              </li>
              <li className="flex gap-2">
                <Mail className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <a className="underline" href={`mailto:${site.contact.email}`}>
                  {site.contact.email}
                </a>
              </li>
              <li className="flex gap-2">
                <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {site.contact.hours}
              </li>
            </ul>
          </div>
          <div className="sm:text-right">
            <p className="font-semibold text-ink">In an emergency, call 911.</p>
            <p className="mt-1">This website is for non-emergency city services.</p>
            <p className="mt-4 text-xs">
              <Link href="/" className="underline">
                Choose a different city
              </Link>{" "}
              · Powered by MunicipalOS
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
