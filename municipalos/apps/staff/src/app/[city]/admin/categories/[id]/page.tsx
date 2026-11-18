import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, PageHeader } from "@municipalos/ui";
import { EditCategoryForm } from "../../forms";
import { adminContext, adminGet } from "../../load";
import type { AdminCategory, Department } from "../../types";

export const metadata: Metadata = { title: "Edit category" };

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ city: string; id: string }>;
}) {
  const { slug } = await adminContext(params);
  const { id } = await params;
  const [{ items }, { items: departments }] = await Promise.all([
    adminGet<{ items: AdminCategory[] }>(slug, "/admin/categories"),
    adminGet<{ items: Department[] }>(slug, "/departments"),
  ]);
  const category = items.find((c) => c.id === id);
  if (!category) notFound();
  return (
    <>
      <Link
        href={`/${slug}/admin/categories`}
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> All categories
      </Link>
      <PageHeader title={`Edit ${category.name}`} />
      <Card className="max-w-xl p-5">
        <EditCategoryForm slug={slug} category={category} departments={departments} />
      </Card>
    </>
  );
}
