import type { Metadata } from "next";
import { Card, PageHeader } from "@municipalos/ui";
import { SettingsForm } from "../forms";
import { adminContext, adminGet } from "../load";
import type { MunicipalSettings } from "../types";

export const metadata: Metadata = { title: "City settings" };

export default async function SettingsPage({ params }: { params: Promise<{ city: string }> }) {
  const { slug } = await adminContext(params);
  const settings = await adminGet<MunicipalSettings>(slug, "/admin/settings");
  return (
    <>
      <PageHeader
        title="City settings"
        description="Branding and contact details shown on the public website, and the reporting policy."
      />
      <Card className="max-w-2xl p-5">
        <SettingsForm slug={slug} settings={settings} />
      </Card>
    </>
  );
}
