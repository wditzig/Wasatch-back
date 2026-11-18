import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Megaphone, Plus } from "lucide-react";
import {
  Card,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
  buttonClass,
  formatDateTime,
  formatRelative,
} from "@municipalos/ui";
import { api } from "@/lib/api";
import { base, getStaffMe } from "@/lib/staff";
import { PageBadges } from "./status";
import type { PageListItem } from "./types";

export const metadata: Metadata = { title: "Website" };

export default async function ContentPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const me = await getStaffMe(city);
  if (!me.permissions.includes("content.read")) notFound();
  const slug = me.municipality.slug;
  const canEdit = me.permissions.includes("content.edit");
  const { items } = await api<{ items: PageListItem[] }>(`${base(slug)}/content/pages`);

  return (
    <>
      <PageHeader
        title="Website"
        description="Pages on the public website. Changes are public only after review and approval."
        actions={
          <>
            <Link href={`/${slug}/content/announcements`} className={buttonClass("secondary")}>
              <Megaphone className="size-4" aria-hidden="true" />
              Announcements
            </Link>
            {canEdit ? (
              <Link href={`/${slug}/content/new`} className={buttonClass("primary")}>
                <Plus className="size-4" aria-hidden="true" />
                New page
              </Link>
            ) : null}
          </>
        }
      />
      <Card>
        {items.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-8" />}
            title="No pages yet"
            description={
              canEdit
                ? "Create the first page for your website."
                : "Pages will appear here once an editor creates them."
            }
            action={
              canEdit ? (
                <Link href={`/${slug}/content/new`} className={buttonClass("primary")}>
                  New page
                </Link>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <caption className="sr-only">Website pages</caption>
            <thead>
              <tr>
                <Th>Page</Th>
                <Th>Status</Th>
                <Th>In navigation</Th>
                <Th>Last changed</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((page) => (
                <tr key={page.id}>
                  <Td>
                    <Link
                      href={`/${slug}/content/${page.id}`}
                      className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
                    >
                      {page.title}
                    </Link>
                    <p className="mt-0.5 font-mono text-xs text-ink-muted">/p/{page.slug}</p>
                  </Td>
                  <Td>
                    <PageBadges page={page} />
                    {page.scheduledFor ? (
                      <p className="mt-1 text-xs text-ink-muted">
                        Goes live {formatDateTime(page.scheduledFor, me.timezone)}
                      </p>
                    ) : null}
                  </Td>
                  <Td>{page.showInNav ? "Yes" : "No"}</Td>
                  <Td className="whitespace-nowrap text-ink-muted">
                    {formatRelative(page.updatedAt)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
