import assert from "node:assert/strict";
import test from "node:test";
import { ImageValidationError, MAX_IMAGE_BYTES, validateImageBytes } from "./image.ts";

function png(width = 1, height = 1) {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  bytes[16] = (width >>> 24) & 0xff; bytes[17] = (width >>> 16) & 0xff; bytes[18] = (width >>> 8) & 0xff; bytes[19] = width & 0xff;
  bytes[20] = (height >>> 24) & 0xff; bytes[21] = (height >>> 16) & 0xff; bytes[22] = (height >>> 8) & 0xff; bytes[23] = height & 0xff;
  return bytes;
}

test("image validation checks actual signatures, supported MIME, and dimensions", () => {
  const valid = validateImageBytes(png(), "image/png");
  assert.equal(valid.mime, "image/png");
  assert.equal(valid.width, 1);
  assert.equal(valid.height, 1);
  assert.equal(valid.sha256.length, 64);
  assert.throws(() => validateImageBytes(png(), "image/jpeg"), ImageValidationError);
  assert.throws(() => validateImageBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "image/png"), ImageValidationError);
  assert.throws(() => validateImageBytes(png(10_001, 1), "image/png"), ImageValidationError);
});

test("image validation rejects unsupported formats and actual bytes beyond 8 MiB", () => {
  assert.throws(() => validateImageBytes(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]), "image/gif"), ImageValidationError);
  assert.throws(() => validateImageBytes(new Uint8Array(MAX_IMAGE_BYTES + 1), "image/png"), ImageValidationError);
});
