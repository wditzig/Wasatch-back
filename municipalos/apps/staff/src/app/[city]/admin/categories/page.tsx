import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, Card, CardHeader, PageHeader, Table, Td, Th } from "@municipalos/ui";
import { CreateCategoryForm } from "../forms";
import { adminContext, adminGet } from "../load";
import type { AdminCategory, Department } from "../types";

export const metadata: Metadata = { title: "Request categories" };

export default async function CategoriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { slug } = await adminContext(params);
  const [{ items }, { items: departments }] = await Promise.all([
    adminGet<{ items: AdminCategory[] }>(slug, "/admin/categories"),
    adminGet<{ items: Department[] }>(slug, "/departments"),
  ]);
  return (
    <>
      <PageHeader
        title="Request categories"
        description="What residents can report, and which department each kind of request goes to."
      />
      {(await searchParams).saved ? (
        <Alert tone="success" live className="mb-6">
          Category saved.
        </Alert>
      ) : null}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Table>
            <caption className="sr-only">Service request categories</caption>
            <thead>
              <tr>
                <Th>Category</Th>
                <Th>Routes to</Th>
                <Th>Status</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <span className="font-medium text-ink">{c.name}</span>
                    {c.description ? (
                      <span className="block text-ink-muted">{c.description}</span>
                    ) : null}
                    {c.keywords.length > 0 ? (
                      <span className="mt-1 block text-xs text-ink-muted">
                        Keywords: {c.keywords.join(", ")}
                      </span>
                    ) : null}
                  </Td>
                  <Td>{c.departmentName}</Td>
                  <Td>
                    <Badge tone={c.isActive ? "green" : "neutral"}>
                      {c.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </Td>
                  <Td>
                    <Link
                      href={`/${slug}/admin/categories/${c.id}`}
                      className="font-medium text-brand-700 underline"
                    >
                      Edit<span className="sr-only"> {c.name}</span>
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHeader title="Add a category" />
          <div className="p-5">
            <CreateCategoryForm slug={slug} departments={departments} />
          </div>
        </Card>
      </div>
    </>
  );
}
