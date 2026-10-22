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

test("normalizeVisionExtraction normalizes all 4 Myanmar receipt patterns", async () => {
  const { normalizeVisionExtraction } = await import("./normalize-extraction.ts");

  // 1. A+ Pay pattern
  const aPlus = normalizeVisionExtraction({
    amount_mmk: "10,000.00 MMK",
    transaction_reference: "55063128860426700315",
    provider: "A+ Pay",
    transaction_date: "03 Dec 2024",
    transaction_time: "01:02:31",
    payer_name: "Kyaw Zay Ya",
    payee_name: "Yoon Yati Linn",
    payee_account: "XXXXXXX4086",
  });
  assert.ok(aPlus);
  assert.equal(aPlus.amount_mmk, 10000);
  assert.equal(aPlus.transaction_reference, "55063128860426700315");
  assert.equal(aPlus.provider, "A+ Pay");
  assert.equal(aPlus.transaction_date, "2024-12-03");
  assert.equal(aPlus.transaction_time, "01:02:31");
  assert.equal(aPlus.payer_name, "Kyaw Zay Ya");
  assert.equal(aPlus.payee_name, "Yoon Yati Linn");
  assert.equal(aPlus.payee_account, "XXXXXXX4086");

  // 2. KBZ Bank pattern with negative amount and embedded masked account
  const kbz = normalizeVisionExtraction({
    amount: "-62,400.00 Ks",
    transaction_no: "01004301040235671814",
    provider: "KBZ Bank",
    date: "11/10/2026",
    time: "19:02:12",
    transfer_to: "Phyo Nadi (******4234)",
  });
  assert.ok(kbz);
  assert.equal(kbz.amount_mmk, 62400);
  assert.equal(kbz.transaction_reference, "01004301040235671814");
  assert.equal(kbz.provider, "KBZPay");
  assert.equal(kbz.transaction_date, "2026-10-11");
  assert.equal(kbz.transaction_time, "19:02:12");
  assert.equal(kbz.payee_name, "Phyo Nadi");
  assert.equal(kbz.payee_account, "******4234");

  // 3. WavePay pattern with 12h AM/PM time
  const wave = normalizeVisionExtraction({
    total_amount: "1,000 Ks",
    transaction_id: "371515335",
    provider: "WavePay",
    date_time: "18 April 2024 • 3:06 PM",
    recipient_name: "Myat Myat Su",
    recipient_account: "0976541XXXX",
  });
  assert.ok(wave);
  assert.equal(wave.amount_mmk, 1000);
  assert.equal(wave.transaction_reference, "371515335");
  assert.equal(wave.provider, "WavePay");
  assert.equal(wave.transaction_date, "2024-04-18");
  assert.equal(wave.transaction_time, "15:06");
  assert.equal(wave.payee_name, "Myat Myat Su");
  assert.equal(wave.payee_account, "0976541XXXX");

  // 4. AYA Pay pattern with sender/receiver fields
  const aya = normalizeVisionExtraction({
    amount: "+283,500 MMK",
    transaction_code: "276189415925",
    provider: "AYA Pay",
    date_and_time: "1 October 2026, 3:16 PM",
    sender_name: "KHIN ZAR CHI OO",
    receiver_name: "YOON YATI LINN",
    receiver_phone: "09757109900",
  });
  assert.ok(aya);
  assert.equal(aya.amount_mmk, 283500);
  assert.equal(aya.transaction_reference, "276189415925");
  assert.equal(aya.provider, "AYA Pay");
  assert.equal(aya.transaction_date, "2026-10-01");
  assert.equal(aya.transaction_time, "15:16");
  assert.equal(aya.payer_name, "KHIN ZAR CHI OO");
  assert.equal(aya.payee_name, "YOON YATI LINN");
  assert.equal(aya.payee_account, "09757109900");
});

