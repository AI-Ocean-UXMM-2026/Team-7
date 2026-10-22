import { screenshotExtractionSchema } from "@ocean/contracts";

const requiredFields = ["amount_mmk", "transaction_reference", "provider", "transaction_date", "transaction_time", "payer_name", "payee_name"] as const;

const MONTH_MAP: Record<string, string> = {
  jan: "01", january: "01",
  feb: "02", february: "02",
  mar: "03", march: "03",
  apr: "04", april: "04",
  may: "05",
  jun: "06", june: "06",
  jul: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", sept: "09", september: "09",
  oct: "10", october: "10",
  nov: "11", november: "11",
  dec: "12", december: "12",
};

export function parseFlexibleDate(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const ymd = /(?:^|\s)(\d{4})[/-](\d{1,2})[/-](\d{1,2})/u.exec(s);
  if (ymd) {
    const year = ymd[1]!;
    const month = ymd[2]!.padStart(2, "0");
    const day = ymd[3]!.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const ddmmyyyy = /(?:^|\s)(\d{1,2})[/-](\d{1,2})[/-](\d{4})/u.exec(s);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1]!.padStart(2, "0");
    const month = ddmmyyyy[2]!.padStart(2, "0");
    const year = ddmmyyyy[3]!;
    return `${year}-${month}-${day}`;
  }
  const ddMonthYyyy = /(?:^|\s)(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/u.exec(s);
  if (ddMonthYyyy) {
    const day = ddMonthYyyy[1]!.padStart(2, "0");
    const month = MONTH_MAP[ddMonthYyyy[2]!.toLowerCase()];
    const year = ddMonthYyyy[3]!;
    if (month) return `${year}-${month}-${day}`;
  }
  const monthDdYyyy = /(?:^|\s)([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/u.exec(s);
  if (monthDdYyyy) {
    const month = MONTH_MAP[monthDdYyyy[1]!.toLowerCase()];
    const day = monthDdYyyy[2]!.padStart(2, "0");
    const year = monthDdYyyy[3]!;
    if (month) return `${year}-${month}-${day}`;
  }
  return null;
}

export function parseFlexibleTime(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  // 1. Look for 12-hour AM/PM pattern e.g. "3:06 PM", "18 April 2024 • 3:06 PM"
  const ampm = /(?:^|\s|[•,T])(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)(?:$|\s)/iu.exec(s);
  if (ampm) {
    let h = parseInt(ampm[1]!, 10);
    const m = ampm[2]!;
    const sec = ampm[3] ? `:${ampm[3]}` : "";
    const isPm = ampm[4]!.toLowerCase() === "pm";
    if (isPm && h < 12) h += 12;
    if (!isPm && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${m}${sec}`;
  }
  // 2. Look for 24-hour pattern e.g. "19:02:12", "01:02:31"
  const hms = /(?:^|\s|[•,T])(\d{1,2}):(\d{2})(?::(\d{2}))?(?:$|\s)/u.exec(s);
  if (hms) {
    const h = hms[1]!.padStart(2, "0");
    const m = hms[2]!;
    const sec = hms[3] ? `:${hms[3]}` : "";
    return `${h}:${m}${sec}`;
  }
  return null;
}

function normalizeProviderName(name: string | null): string | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower.includes("kbzpay") || lower.includes("kbz bank") || lower.includes("kpay")) return "KBZPay";
  if (lower.includes("wavepay") || lower.includes("wave money")) return "WavePay";
  if (lower.includes("aya pay") || lower.includes("aya bank")) return "AYA Pay";
  if (lower.includes("a+ pay") || lower.includes("a+ wallet") || lower === "a+") return "A+ Pay";
  if (lower.includes("cb pay") || lower.includes("cb bank")) return "CB Pay";
  if (lower.includes("uabpay") || lower.includes("uab bank")) return "uabpay";
  return name;
}

export function normalizeVisionExtraction(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const source = input as Record<string, unknown>;
  const text = (value: unknown, max: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

  const rawAmount = source.amount_mmk ?? source.amount ?? source.total_amount ?? source.total;
  const amountText = typeof rawAmount === "string" ? rawAmount.trim().replace(/[−–]/gu, "-").replace(/(?:MMK|Ks|ကျပ်)/giu, "").replaceAll(",", "").trim() : "";
  const amountValue = typeof rawAmount === "number" ? rawAmount : /^[+-]?\d+(?:\.00?)?$/u.test(amountText) ? Number(amountText) : null;
  const amount_mmk = amountValue !== null && Number.isSafeInteger(amountValue) ? Math.abs(amountValue) : null;

  const rawRef = source.transaction_reference ?? source.transaction_code ?? source.transaction_no ?? source.transaction_id ?? source.ref_no;
  const transaction_reference = text(rawRef, 160);

  const rawDate = source.transaction_date ?? source.date ?? source.transaction_time;
  const rawTime = source.transaction_time ?? source.time;
  const combinedDateTime = typeof source.date_and_time === "string" ? source.date_and_time : typeof source.date_time === "string" ? source.date_time : null;

  let parsedDate = parseFlexibleDate(text(rawDate, 80));
  let parsedTime = parseFlexibleTime(text(rawTime, 80));

  if ((!parsedDate || !parsedTime) && combinedDateTime) {
    if (!parsedDate) parsedDate = parseFlexibleDate(combinedDateTime);
    if (!parsedTime) parsedTime = parseFlexibleTime(combinedDateTime);
  }

  const rawPayeeName = source.payee_name ?? source.recipient_name ?? source.receiver_name ?? source.transfer_to;
  let payee_name = text(rawPayeeName, 160);
  let payee_account = text(source.payee_account ?? source.recipient_account ?? source.receiver_phone, 80);

  // If payee_name contains embedded masked account e.g. "Phyo Nadi (******4234)"
  if (payee_name && !payee_account) {
    const accountMatch = /^(.+?)\s*\(([^)]+)\)$/u.exec(payee_name);
    if (accountMatch) {
      payee_name = accountMatch[1]!.trim();
      payee_account = accountMatch[2]!.trim();
    }
  }

  const rawPayerName = source.payer_name ?? source.sender_name ?? source.transfer_from;
  const payer_name = text(rawPayerName, 160);

  const provider = normalizeProviderName(text(source.provider, 80));

  const candidate = {
    amount_mmk,
    transaction_reference,
    provider,
    transaction_date: parsedDate,
    transaction_time: parsedTime,
    transaction_time_uncertain: source.transaction_time_uncertain === false ? false : true,
    payer_name,
    payee_name,
    payee_account,
    missing_fields: [] as string[],
    uncertain_fields: Array.isArray(source.uncertain_fields) ? source.uncertain_fields.filter((item): item is string => typeof item === "string" && item.length > 0 && item.length <= 80).slice(0, 24) : [],
  };

  if (candidate.amount_mmk === null && candidate.transaction_reference === null && candidate.provider === null && candidate.transaction_date === null && candidate.transaction_time === null && candidate.payer_name === null && candidate.payee_name === null && candidate.payee_account === null) return null;
  for (const field of requiredFields) if (candidate[field] === null) candidate.missing_fields.push(field);
  const parsed = screenshotExtractionSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

