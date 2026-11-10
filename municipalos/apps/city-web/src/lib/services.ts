import "server-only";
import { notFound } from "next/navigation";
import { api, getSite } from "./api";
import type { ServiceCategory } from "./types";

/** Service-request pages only exist for municipalities with the module enabled. */
export async function requireServiceRequests(city: string) {
  const site = await getSite(city);
  if (!site.modules.includes("service_requests")) notFound();
  return site;
}

export async function getCategories(city: string): Promise<ServiceCategory[]> {
  const { items } = await api<{ items: ServiceCategory[] }>(
    `/v1/public/municipalities/${city}/service-categories`,
  );
  return items;
}
