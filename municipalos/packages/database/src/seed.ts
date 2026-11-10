/**
 * Synthetic demonstration data. Every municipality, person, address and request here is
 * fictional. Never load this into a production database.
 */
import { hashPassword } from "@municipalos/auth";
import { SYSTEM_ROLES, type SystemRoleKey } from "@municipalos/permissions";
import type { ServiceRequestStatus } from "@municipalos/workflows";
import { withTenant, type Db, type Tx } from "./client";
import * as s from "./schema";

/** Shared password for all seeded staff accounts. Development and test only. */
export const DEMO_PASSWORD = "municipalos-dev-password";

interface StaffSeed {
  email: string;
  name: string;
  title: string;
  role: SystemRoleKey;
  department?: string;
}
interface CategorySeed {
  slug: string;
  name: string;
  description: string;
  department: string;
  keywords: string[];
}
interface RequestSeed {
  reference: string;
  category: string;
  status: ServiceRequestStatus;
  description: string;
  locationText: string;
  lat?: number;
  lng?: number;
  reporterName?: string;
  reporterEmail?: string;
  assignee?: string;
  daysAgo: number;
}
interface MunicipalitySeed {
  slug: string;
  name: string;
  state: string;
  timezone: string;
  prefix: string;
  hostname: string;
  branding: s.Branding;
  contact: s.ContactInfo;
  departments: { slug: string; name: string; description: string; phone: string; email: string }[];
  categories: CategorySeed[];
  staff: StaffSeed[];
  announcements: { title: string; body: string; daysAgo: number }[];
  requests: RequestSeed[];
}

const standardCategories = (publicWorks: string, parks: string): CategorySeed[] => [
  { slug: "pothole", name: "Pothole", description: "Potholes or damaged pavement on a city street.", department: publicWorks, keywords: ["pothole", "pot hole", "pavement", "asphalt", "road damage", "crater"] },
  { slug: "streetlight", name: "Streetlight", description: "A streetlight that is out, flickering or damaged.", department: publicWorks, keywords: ["streetlight", "street light", "lamp", "light out", "flickering", "dark"] },
  { slug: "damaged-sign", name: "Damaged or missing sign", description: "Street or traffic signs that are damaged, faded or missing.", department: publicWorks, keywords: ["sign", "stop sign", "street sign", "knocked down", "missing sign"] },
  { slug: "sidewalk", name: "Sidewalk problem", description: "Cracked, raised or blocked sidewalks.", department: publicWorks, keywords: ["sidewalk", "trip hazard", "curb", "walkway", "cracked"] },
  { slug: "parks-maintenance", name: "Parks maintenance", description: "Problems in a city park, trail or playground.", department: parks, keywords: ["park", "playground", "trail", "swing", "bench", "restroom", "sprinkler", "field"] },
  { slug: "graffiti", name: "Graffiti", description: "Graffiti on public property.", department: publicWorks, keywords: ["graffiti", "spray paint", "tagging", "vandalism"] },
  { slug: "other", name: "Other public works issue", description: "Any other non-emergency issue with city streets or facilities.", department: publicWorks, keywords: [] },
];

const MUNICIPALITIES: MunicipalitySeed[] = [
  {
    slug: "cedar-ridge",
    name: "Cedar Ridge",
    state: "UT",
    timezone: "America/Denver",
    prefix: "CR",
    hostname: "cedar-ridge.localhost",
    branding: { primaryColor: "#1f5f8b", tagline: "A mountain community that works." },
    contact: {
      address: "120 Civic Center Way, Cedar Ridge, UT 84000",
      phone: "(435) 555-0100",
      email: "cityhall@cedarridge.example",
      hours: "Monday–Friday, 8:00 am – 5:00 pm",
    },
    departments: [
      { slug: "public-works", name: "Public Works", description: "Streets, sidewalks, streetlights, signs and snow removal.", phone: "(435) 555-0120", email: "publicworks@cedarridge.example" },
      { slug: "parks-recreation", name: "Parks & Recreation", description: "City parks, trails, playgrounds and recreation programs.", phone: "(435) 555-0130", email: "parks@cedarridge.example" },
      { slug: "community-development", name: "Community Development", description: "Planning, zoning, building permits and business licensing.", phone: "(435) 555-0140", email: "planning@cedarridge.example" },
      { slug: "city-clerk", name: "City Clerk", description: "Public records, council meetings and elections.", phone: "(435) 555-0110", email: "clerk@cedarridge.example" },
    ],
    categories: standardCategories("public-works", "parks-recreation"),
    staff: [
      { email: "dana.whitaker@cedarridge.example", name: "Dana Whitaker", title: "City Manager", role: "municipal_admin" },
      { email: "luis.ortega@cedarridge.example", name: "Luis Ortega", title: "Public Works Director", role: "department_admin", department: "public-works" },
      { email: "priya.nair@cedarridge.example", name: "Priya Nair", title: "Streets Maintenance Technician", role: "department_employee", department: "public-works" },
      { email: "tom.becker@cedarridge.example", name: "Tom Becker", title: "Parks Supervisor", role: "department_employee", department: "parks-recreation" },
      { email: "helen.cho@cedarridge.example", name: "Helen Cho", title: "City Clerk", role: "city_clerk", department: "city-clerk" },
      { email: "avery.stone@cedarridge.example", name: "Avery Stone", title: "Internal Auditor", role: "auditor" },
    ],
    announcements: [
      { title: "Spring street sweeping begins April 14", body: "Crews will sweep residential streets by zone over three weeks. Please move vehicles off the street on your scheduled day.", daysAgo: 2 },
      { title: "City Council meets the second and fourth Tuesday", body: "Meetings start at 6:30 pm in Council Chambers at City Hall and are open to the public.", daysAgo: 9 },
    ],
    requests: [
      { reference: "CR-SAMP0001", category: "pothole", status: "new", description: "Deep pothole in the northbound lane, roughly two feet wide. Cars are swerving around it.", locationText: "400 N Main St, near the library", lat: 40.6461, lng: -111.498, reporterName: "Jordan Ellis", reporterEmail: "jordan.ellis@residents.example", daysAgo: 0 },
      { reference: "CR-SAMP0002", category: "streetlight", status: "reviewed", description: "Streetlight has been out for a week. The corner is very dark at night.", locationText: "Corner of Aspen Dr and 200 E", lat: 40.6502, lng: -111.4925, daysAgo: 1 },
      { reference: "CR-SAMP0003", category: "sidewalk", status: "assigned", description: "Tree roots have lifted a sidewalk panel about three inches. Trip hazard near the school.", locationText: "155 W Center St", lat: 40.6448, lng: -111.5012, reporterName: "Maria Santos", reporterEmail: "maria.santos@residents.example", assignee: "priya.nair@cedarridge.example", daysAgo: 3 },
      { reference: "CR-SAMP0004", category: "damaged-sign", status: "in_progress", description: "Stop sign was knocked over and is lying in the grass.", locationText: "Intersection of Ridge Rd and Juniper Ln", lat: 40.6533, lng: -111.489, assignee: "priya.nair@cedarridge.example", daysAgo: 4 },
      { reference: "CR-SAMP0005", category: "parks-maintenance", status: "new", description: "The swing set at the playground has a broken chain on the left swing.", locationText: "Miller Park playground", lat: 40.6419, lng: -111.4951, reporterName: "Sam Patel", reporterEmail: "sam.patel@residents.example", daysAgo: 1 },
      { reference: "CR-SAMP0006", category: "graffiti", status: "resolved", description: "Spray paint on the pedestrian underpass wall.", locationText: "Riverside Trail underpass at 300 S", assignee: "priya.nair@cedarridge.example", daysAgo: 8 },
      { reference: "CR-SAMP0007", category: "pothole", status: "closed", description: "Pothole at the entrance to the post office parking lot.", locationText: "75 E 100 S", reporterName: "Chris Wong", reporterEmail: "chris.wong@residents.example", assignee: "priya.nair@cedarridge.example", daysAgo: 15 },
      { reference: "CR-SAMP0008", category: "parks-maintenance", status: "in_progress", description: "Sprinkler head is broken and flooding the soccer field sideline.", locationText: "Cedar Ridge Sports Complex, field 2", assignee: "tom.becker@cedarridge.example", daysAgo: 2 },
    ],
  },
  {
    slug: "marlow-springs",
    name: "Marlow Springs",
    state: "CO",
    timezone: "America/Denver",
    prefix: "MS",
    hostname: "marlow-springs.localhost",
    branding: { primaryColor: "#2f6b4f", tagline: "Small town. Open doors." },
    contact: {
      address: "8 Founders Square, Marlow Springs, CO 80000",
      phone: "(970) 555-0200",
      email: "info@marlowsprings.example",
      hours: "Monday–Thursday, 7:30 am – 5:30 pm",
    },
    departments: [
      { slug: "public-works", name: "Public Works", description: "Roads, drainage, signs and street lighting.", phone: "(970) 555-0220", email: "pw@marlowsprings.example" },
      { slug: "parks", name: "Parks & Open Space", description: "Parks, open space and trail maintenance.", phone: "(970) 555-0230", email: "parks@marlowsprings.example" },
      { slug: "town-clerk", name: "Town Clerk", description: "Records, licensing and council support.", phone: "(970) 555-0210", email: "clerk@marlowsprings.example" },
    ],
    categories: standardCategories("public-works", "parks").filter((c) => c.slug !== "graffiti"),
    staff: [
      { email: "grace.okafor@marlowsprings.example", name: "Grace Okafor", title: "Town Administrator", role: "municipal_admin" },
      { email: "ben.hale@marlowsprings.example", name: "Ben Hale", title: "Public Works Operator", role: "department_employee", department: "public-works" },
    ],
    announcements: [
      { title: "Founders Square farmers market returns in May", body: "Every Saturday morning from 8 am to noon through September.", daysAgo: 5 },
    ],
    requests: [
      { reference: "MS-SAMP0001", category: "pothole", status: "new", description: "Pothole forming at the bottom of the hill, getting bigger after the rain.", locationText: "Spring Creek Rd at Hillcrest Ave", lat: 39.5501, lng: -107.3248, reporterName: "Pat Nguyen", reporterEmail: "pat.nguyen@residents.example", daysAgo: 1 },
      { reference: "MS-SAMP0002", category: "streetlight", status: "assigned", description: "Two streetlights in a row are out along the square.", locationText: "Founders Square, east side", assignee: "ben.hale@marlowsprings.example", daysAgo: 3 },
      { reference: "MS-SAMP0003", category: "parks-maintenance", status: "new", description: "Trail bridge has a loose railing board.", locationText: "Marlow Creek Trail, first footbridge", daysAgo: 2 },
    ],
  },
];

const HISTORY: ServiceRequestStatus[] = ["new", "reviewed", "assigned", "in_progress", "resolved", "closed"];
const daysAgo = (n: number, plusHours = 0) => new Date(Date.now() - n * 86_400_000 + plusHours * 3_600_000);

async function seedMunicipality(db: Db, m: MunicipalitySeed, passwordHash: string) {
  const [muni] = await db
    .insert(s.municipalities)
    .values({ slug: m.slug, name: m.name, state: m.state, timezone: m.timezone, referencePrefix: m.prefix, status: "active" })
    .returning();
  if (!muni) throw new Error("insert failed");
  await db.insert(s.municipalityDomains).values({ municipalityId: muni.id, hostname: m.hostname, isPrimary: true });

  const userIds = new Map<string, string>();
  for (const st of m.staff) {
    const [u] = await db.insert(s.users).values({ email: st.email, name: st.name, passwordHash }).returning();
    userIds.set(st.email, u!.id);
  }

  await withTenant(db, { municipalityId: muni.id }, async (tx: Tx) => {
    const t = { municipalityId: muni.id };
    await tx.insert(s.municipalitySettings).values({ ...t, branding: m.branding, contact: m.contact });
    await tx.insert(s.moduleEntitlements).values([
      { ...t, moduleKey: "website" },
      { ...t, moduleKey: "service_requests" },
    ]);

    const deptIds = new Map<string, string>();
    for (const [i, d] of m.departments.entries()) {
      const [row] = await tx.insert(s.departments).values({ ...t, ...d, sortOrder: i }).returning();
      deptIds.set(d.slug, row!.id);
    }

    const roleIds = new Map<string, string>();
    for (const r of SYSTEM_ROLES) {
      const [row] = await tx
        .insert(s.roles)
        .values({ ...t, key: r.key, name: r.name, description: r.description, isSystem: true })
        .returning();
      roleIds.set(r.key, row!.id);
      if (r.permissions.length > 0) {
        await tx.insert(s.rolePermissions).values(r.permissions.map((permission) => ({ ...t, roleId: row!.id, permission })));
      }
    }

    for (const st of m.staff) {
      await tx.insert(s.staffMemberships).values({
        ...t,
        userId: userIds.get(st.email)!,
        roleId: roleIds.get(st.role)!,
        departmentId: st.department ? deptIds.get(st.department)! : null,
        title: st.title,
      });
    }

    const catIds = new Map<string, { id: string; departmentId: string }>();
    for (const [i, c] of m.categories.entries()) {
      const departmentId = deptIds.get(c.department)!;
      const [row] = await tx
        .insert(s.serviceRequestCategories)
        .values({ ...t, departmentId, slug: c.slug, name: c.name, description: c.description, keywords: c.keywords, sortOrder: i })
        .returning();
      catIds.set(c.slug, { id: row!.id, departmentId });
    }

    await tx.insert(s.announcements).values(m.announcements.map((a) => ({ ...t, title: a.title, body: a.body, publishedAt: daysAgo(a.daysAgo) })));

    for (const r of m.requests) {
      const cat = catIds.get(r.category)!;
      const created = daysAgo(r.daysAgo, -2);
      const reached = HISTORY.slice(0, HISTORY.indexOf(r.status) + 1);
      const assigneeId = r.assignee ? userIds.get(r.assignee)! : null;
      const stepAt = (i: number) => new Date(created.getTime() + i * 20 * 60_000);
      const [req] = await tx
        .insert(s.serviceRequests)
        .values({
          ...t,
          reference: r.reference,
          categoryId: cat.id,
          departmentId: cat.departmentId,
          status: r.status,
          description: r.description,
          locationText: r.locationText,
          latitude: r.lat ?? null,
          longitude: r.lng ?? null,
          reporterName: r.reporterName ?? null,
          reporterEmail: r.reporterEmail ?? null,
          assignedToUserId: reached.includes("assigned") ? assigneeId : null,
          createdAt: created,
          updatedAt: stepAt(reached.length - 1),
          resolvedAt: reached.includes("resolved") ? stepAt(HISTORY.indexOf("resolved")) : null,
          closedAt: reached.includes("closed") ? stepAt(HISTORY.indexOf("closed")) : null,
        })
        .returning();
      const base = { ...t, requestId: req!.id };
      await tx.insert(s.serviceRequestEvents).values({ ...base, type: "created", visibility: "public", toStatus: "new", actorKind: "resident", createdAt: created });
      for (let i = 1; i < reached.length; i++) {
        const to = reached[i]!;
        if (to === "assigned" && assigneeId) {
          await tx.insert(s.serviceRequestEvents).values({ ...base, type: "assigned", visibility: "internal", actorKind: "staff", subjectUserId: assigneeId, createdAt: stepAt(i) });
        }
        await tx.insert(s.serviceRequestEvents).values({
          ...base,
          type: "status_changed",
          visibility: "public",
          fromStatus: reached[i - 1]!,
          toStatus: to,
          actorKind: "staff",
          actorUserId: assigneeId,
          createdAt: stepAt(i),
        });
      }
    }
  });
  return muni;
}

export async function seedDemo(db: Db): Promise<{ municipalities: string[]; staffPassword: string }> {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production.");
  const existing = await db.select({ id: s.municipalities.id }).from(s.municipalities).limit(1);
  if (existing.length > 0) throw new Error("Database already contains municipalities. Run `pnpm db:reset` to reseed.");
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const m of MUNICIPALITIES) await seedMunicipality(db, m, passwordHash);
  // MunicipalOS platform staff: deliberately has no municipal membership.
  await db.insert(s.users).values({ email: "ops@municipalos.example", name: "Platform Operations", passwordHash, isPlatformAdmin: true });
  return { municipalities: MUNICIPALITIES.map((m) => m.slug), staffPassword: DEMO_PASSWORD };
}
