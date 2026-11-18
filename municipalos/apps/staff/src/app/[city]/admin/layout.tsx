import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { NavLink } from "@/components/nav-link";
import { getStaffMe } from "@/lib/staff";
import { ADMIN_SECTIONS } from "./types";

export default async function AdminLayout({
  params,
  children,
}: {
  params: Promise<{ city: string }>;
  children: ReactNode;
}) {
  const me = await getStaffMe((await params).city);
  const sections = ADMIN_SECTIONS.filter((s) => me.permissions.includes(s.permission));
  if (sections.length === 0) notFound();
  return (
    <>
      <nav aria-label="Administration" className="mb-6 border-b border-line pb-3">
        <ul className="flex flex-wrap gap-1">
          {sections.map((s) => (
            <li key={s.path}>
              <NavLink href={`/${me.municipality.slug}/admin/${s.path}`}>{s.label}</NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </>
  );
}
