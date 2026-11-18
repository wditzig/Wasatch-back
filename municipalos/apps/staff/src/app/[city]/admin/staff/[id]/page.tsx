import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, PageHeader } from "@municipalos/ui";
import { MembershipForm } from "../../forms";
import { adminContext, adminGet } from "../../load";
import type { Department, Role, StaffMember } from "../../types";

export const metadata: Metadata = { title: "Change access" };

export default async function EditMembershipPage({
  params,
}: {
  params: Promise<{ city: string; id: string }>;
}) {
  const { me, slug } = await adminContext(params);
  const { id } = await params;
  if (!me.permissions.includes("staff.manage")) notFound();
  const [{ items: members }, { items: roles }, { items: departments }] = await Promise.all([
    adminGet<{ items: StaffMember[] }>(slug, "/admin/staff"),
    adminGet<{ items: Role[] }>(slug, "/admin/roles"),
    adminGet<{ items: Department[] }>(slug, "/departments"),
  ]);
  const member = members.find((m) => m.membershipId === id);
  if (!member || member.isSelf) notFound();
  return (
    <>
      <Link
        href={`/${slug}/admin/staff`}
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> All staff
      </Link>
      <PageHeader title={`Change access for ${member.name}`} description={member.email} />
      <Card className="max-w-xl p-5">
        <MembershipForm slug={slug} member={member} roles={roles} departments={departments} />
      </Card>
    </>
  );
}
