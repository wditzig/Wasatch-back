import type { Context } from "hono";
import { AppError, unprocessable } from "../errors";
import { MAX_UPLOAD_BYTES } from "./images";

/** Reads the single `file` part of a multipart upload into memory (bounded by the body limit). */
export async function readUploadedFile(c: Context): Promise<Buffer> {
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw unprocessable("file_required", "Attach a photo.");
  }
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) throw unprocessable("file_required", "Attach a photo.");
  if (file.size > MAX_UPLOAD_BYTES)
    throw new AppError(413, "file_too_large", "Photos must be 15 MB or smaller.");
  return Buffer.from(await file.arrayBuffer());
}

export function photoResponse(c: Context, photo: { bytes: Buffer; contentType: string }): Response {
  return c.body(new Uint8Array(photo.bytes), 200, {
    "Content-Type": photo.contentType,
    "Content-Length": String(photo.bytes.length),
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
  });
}
