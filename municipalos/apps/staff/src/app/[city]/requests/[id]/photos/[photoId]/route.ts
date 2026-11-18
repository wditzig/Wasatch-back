import { fetchPhoto } from "@/lib/files";
import { base } from "@/lib/staff";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ city: string; id: string; photoId: string }> },
) {
  const { city, id, photoId } = await params;
  if (!UUID.test(id) || !UUID.test(photoId)) return new Response("Not found", { status: 404 });
  return fetchPhoto(`${base(city)}/service-requests/${id}/attachments/${photoId}`);
}
