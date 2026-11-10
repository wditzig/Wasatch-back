import { Alert } from "@municipalos/ui";
import { getCategories, requireServiceRequests } from "@/lib/services";
import { ReportForm } from "./report-form";

export const metadata = { title: "Report a problem" };

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { city } = await params;
  const site = await requireServiceRequests(city);
  const categories = await getCategories(city);
  const { category } = await searchParams;
  const preselected = categories.find((c) => c.slug === category);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Report a problem</h1>
      <p className="mt-2 text-ink-muted">
        Tell {site.municipality.name} about a non-emergency issue. It takes about a minute.
      </p>
      <Alert tone="warning" title="For emergencies, call 911." className="my-6">
        Do not use this form for anything that is a danger to life or property right now.
      </Alert>
      <ReportForm
        city={city}
        categories={categories}
        initialCategoryId={preselected?.id ?? ""}
        contactRequired={!site.allowAnonymousRequests}
      />
    </div>
  );
}
