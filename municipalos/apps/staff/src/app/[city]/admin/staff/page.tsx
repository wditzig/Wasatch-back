import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, Card, CardHeader, PageHeader, Table, Td, Th } from "@municipalos/ui";
import { adminContext, adminGet } from "../load";
import type { Role, StaffMember } from "../types";

export const metadata: Metadata = { title: "Staff access" };

export default async function StaffAccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { me, slug } = await adminContext(params);
  const [{ items: members }, { items: roles }] = await Promise.all([
    adminGet<{ items: StaffMember[] }>(slug, "/admin/staff"),
    adminGet<{ items: Role[] }>(slug, "/admin/roles"),
  ]);
  const canManage = me.permissions.includes("staff.manage");
  return (
    <>
      <PageHeader
        title="Staff access"
        description="Who can use MunicipalOS for this city, and what each person can do. Review this list regularly."
      />
      {(await searchParams).saved ? (
        <Alert tone="success" live className="mb-6">
          Access saved. The change is already in effect.
        </Alert>
      ) : null}
      <Card>
        <Table>
          <caption className="sr-only">Staff members and their access</caption>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Role</Th>
              <Th>Department</Th>
              <Th>Status</Th>
              {canManage ? (
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.membershipId}>
                <Td>
                  <span className="font-medium text-ink">{m.name}</span>
                  {m.isSelf ? <span className="text-ink-muted"> (you)</span> : null}
                  <span className="block text-ink-muted">
                    {[m.title, m.email].filter(Boolean).join(" · ")}
                  </span>
                </Td>
                <Td>{m.roleName}</Td>
                <Td>{m.departmentName ?? <span className="text-ink-muted">—</span>}</Td>
                <Td>
                  <Badge tone={m.status === "active" ? "green" : "red"}>
                    {m.status === "active" ? "Active" : "Suspended"}
                  </Badge>
                </Td>
                {canManage ? (
                  <Td>
                    {m.isSelf ? (
                      <span className="text-xs text-ink-muted">
                        You cannot change your own access
                      </span>
                    ) : (
                      <Link
                        href={`/${slug}/admin/staff/${m.membershipId}`}
                        className="font-medium text-brand-700 underline"
                      >
                        Change access<span className="sr-only"> for {m.name}</span>
                      </Link>
                    )}
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Role reference" description="What each role is allowed to do." />
        <ul className="divide-y divide-line">
          {roles.map((r) => (
            <li key={r.id} className="px-5 py-4">
              <h3 className="font-medium text-ink">{r.name}</h3>
              <p className="text-sm text-ink-muted">{r.description}</p>
              {r.permissions.length > 0 ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-ink">
                  {r.permissions.map((p) => (
                    <li key={p.key}>{p.description}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">No permissions yet.</p>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
