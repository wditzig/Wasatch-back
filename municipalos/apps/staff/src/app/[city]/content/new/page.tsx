import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, PageHeader } from "@municipalos/ui";
import { getStaffMe } from "@/lib/staff";
import { NewPageForm } from "./new-page-form";

export const metadata: Metadata = { title: "New page" };

export default async function NewPage({ params }: { params: Promise<{ city: string }> }) {
  const me = await getStaffMe((await params).city);
  if (!me.permissions.includes("content.edit")) notFound();
  const slug = me.municipality.slug;
  return (
    <>
      <Link
        href={`/${slug}/content`}
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Website
      </Link>
      <PageHeader
        title="New page"
        description="The page starts as a private draft. Nothing is public until it is reviewed and published."
      />
      <Card className="max-w-xl p-5">
        <NewPageForm slug={slug} />
      </Card>
    </>
  );
}
