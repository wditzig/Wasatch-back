import sharp from "sharp";
import { AppError } from "../errors";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_DIMENSION = 2000;

type SupportedFormat = "jpeg" | "png" | "webp";

/** Identifies the format from the file's leading bytes, never from its name or declared type. */
export function sniffImageFormat(bytes: Buffer): SupportedFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "jpeg";
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return "png";
  if (
    bytes.length >= 12 &&
    bytes.toString("latin1", 0, 4) === "RIFF" &&
    bytes.toString("latin1", 8, 12) === "WEBP"
  )
    return "webp";
  return null;
}

export interface ProcessedImage {
  bytes: Buffer;
  contentType: "image/jpeg";
  width: number;
  height: number;
}

/**
 * Validates an uploaded photo and re-encodes it as a JPEG.
 *
 * Re-encoding is a security and privacy control, not a convenience: the stored file contains
 * only pixels we produced, so embedded scripts or polyglot payloads do not survive, and all
 * metadata (including GPS position and device details) is dropped.
 */
export async function processUploadedImage(input: Buffer): Promise<ProcessedImage> {
  if (input.length === 0) throw new AppError(422, "empty_file", "The photo is empty.");
  if (input.length > MAX_UPLOAD_BYTES) {
    throw new AppError(413, "file_too_large", "Photos must be 15 MB or smaller.");
  }
  if (!sniffImageFormat(input)) {
    throw new AppError(422, "unsupported_file_type", "Photos must be JPEG, PNG or WebP images.");
  }
  try {
    const { data, info } = await sharp(input, { limitInputPixels: 50_000_000, failOn: "error" })
      .rotate() // apply the camera orientation, then discard it with the rest of the metadata
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return { bytes: data, contentType: "image/jpeg", width: info.width, height: info.height };
  } catch {
    throw new AppError(422, "invalid_image", "That file could not be read as a photo.");
  }
}
