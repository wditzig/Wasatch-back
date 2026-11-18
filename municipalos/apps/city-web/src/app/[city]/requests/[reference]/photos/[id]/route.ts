import { referenceSchema } from "@municipalos/validation";
import { apiPhoto } from "@/lib/api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Serves a request photo. The tracking number in the path is the capability to view it. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ city: string; reference: string; id: string }> },
) {
  const { city, reference, id } = await params;
  const parsed = referenceSchema.safeParse(reference);
  if (!parsed.success || !UUID.test(id) || !/^[a-z0-9-]+$/.test(city))
    return new Response("Not found", { status: 404 });
  return apiPhoto(
    `/v1/public/municipalities/${city}/service-requests/${parsed.data}/attachments/${id}`,
  );
}
