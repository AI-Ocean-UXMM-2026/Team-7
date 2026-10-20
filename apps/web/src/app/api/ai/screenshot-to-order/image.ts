import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { screenshotMimeSchema, type ScreenshotMime } from "@ocean/contracts";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_MULTIPART_REQUEST_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 10_000;
export const MAX_IMAGE_PIXELS = 25_000_000;

export class ImageValidationError extends Error {}
export class RequestTooLargeError extends Error {}

export type ValidatedImage = {
  bytes: Uint8Array;
  mime: ScreenshotMime;
  extension: "jpg" | "png" | "webp";
  sha256: string;
  width: number;
  height: number;
};

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...Array.from(bytes.subarray(offset, offset + length)));
}

function isSignature(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function jpegDimensions(bytes: Uint8Array) {
  if (!isSignature(bytes, [0xff, 0xd8, 0xff])) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++] ?? 0;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 1 >= bytes.length) return null;
    const length = ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
    if (length < 2 || offset + length > bytes.length) return null;
    const isFrame = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
    if (isFrame && offset + 7 < bytes.length) {
      return { width: ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0), height: ((bytes[offset + 3] ?? 0) << 8) | (bytes[offset + 4] ?? 0) };
    }
    offset += length;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array) {
  if (!isSignature(bytes, [0x52, 0x49, 0x46, 0x46]) || ascii(bytes, 8, 4) !== "WEBP") return null;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X" && bytes.length >= 30) {
    return {
      width: 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)),
      height: 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)),
    };
  }
  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    return {
      width: 1 + (bytes[21]! | (bytes[22]! << 8) | ((bytes[23]! & 0x3f) << 16)),
      height: 1 + ((bytes[23]! >> 6) | (bytes[24]! << 2) | ((bytes[25] ?? 0) & 0xf) << 10),
    };
  }
  if (chunk === "VP8 " && bytes.length >= 30 && isSignature(bytes, [0x9d, 0x01, 0x2a], 23)) {
    return { width: (bytes[26]! | (bytes[27]! << 8)) & 0x3fff, height: (bytes[28]! | (bytes[29]! << 8)) & 0x3fff };
  }
  return null;
}

function dimensions(bytes: Uint8Array, mime: ScreenshotMime) {
  if (mime === "image/png") {
    if (bytes.length < 33 || ascii(bytes, 12, 4) !== "IHDR") return null;
    return { width: (bytes[16]! * 0x1000000) + (bytes[17]! << 16) + (bytes[18]! << 8) + bytes[19]!, height: (bytes[20]! * 0x1000000) + (bytes[21]! << 16) + (bytes[22]! << 8) + bytes[23]! };
  }
  return mime === "image/jpeg" ? jpegDimensions(bytes) : webpDimensions(bytes);
}

function signatureMime(bytes: Uint8Array): ScreenshotMime | null {
  if (isSignature(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (isSignature(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (isSignature(bytes, [0x52, 0x49, 0x46, 0x46]) && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
  return null;
}

export function validateImageBytes(input: Uint8Array, declaredMime: string): ValidatedImage {
  if (input.byteLength === 0 || input.byteLength > MAX_IMAGE_BYTES) throw new ImageValidationError("Choose a JPEG, PNG, or WebP image up to 8 MiB.");
  const mime = screenshotMimeSchema.safeParse(declaredMime);
  const actual = signatureMime(input);
  if (!mime.success || !actual || mime.data !== actual) throw new ImageValidationError("The image type is unsupported or does not match its file signature.");
  const size = dimensions(input, actual);
  if (!size || size.width < 1 || size.height < 1 || size.width > MAX_IMAGE_DIMENSION || size.height > MAX_IMAGE_DIMENSION || size.width * size.height > MAX_IMAGE_PIXELS) {
    throw new ImageValidationError("The image dimensions are unsupported or too large.");
  }
  const extension = actual === "image/jpeg" ? "jpg" : actual === "image/png" ? "png" : "webp";
  const bytes = new Uint8Array(input);
  return { bytes, mime: actual, extension, sha256: createHash("sha256").update(Buffer.from(bytes)).digest("hex"), width: size.width, height: size.height };
}

export async function readBoundedRequestBody(request: Request, maxBytes = MAX_MULTIPART_REQUEST_BYTES) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new RequestTooLargeError();
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new RequestTooLargeError();
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

export function imageDataUrl(image: ValidatedImage) {
  return `data:${image.mime};base64,${Buffer.from(image.bytes).toString("base64")}`;
}
