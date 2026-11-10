import Link from "next/link";
import { Card } from "@municipalos/ui";
import { requireServiceRequests } from "@/lib/services";
import { LookupForm } from "./lookup-form";

export const metadata = { title: "Track a request" };

export default async function TrackPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  await requireServiceRequests(city);
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Track a request</h1>
      <p className="mt-2 text-ink-muted">See the status of a problem you reported.</p>
      <Card className="mt-6 p-5">
        <LookupForm city={city} />
      </Card>
      <p className="mt-6 text-sm text-ink-muted">
        Haven&rsquo;t reported it yet?{" "}
        <Link href={`/${city}/report`} className="font-medium text-ink underline">
          Report a problem
        </Link>
      </p>
    </div>
  );
}
