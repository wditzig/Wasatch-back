import { notFound, redirect } from "next/navigation";
import { getStaffMe } from "@/lib/staff";
import { ADMIN_SECTIONS } from "./types";

export default async function AdminIndex({ params }: { params: Promise<{ city: string }> }) {
  const me = await getStaffMe((await params).city);
  const first = ADMIN_SECTIONS.find((s) => me.permissions.includes(s.permission));
  if (!first) notFound();
  redirect(`/${me.municipality.slug}/admin/${first.path}`);
}
