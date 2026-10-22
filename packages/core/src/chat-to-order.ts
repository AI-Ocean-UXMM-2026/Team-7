export type ChatOrderExtractionItem = {
  product_name: string | null;
  quantity: number | null;
  unit_price_mmk: number | null;
};

export type ChatOrderExtraction = {
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  notes: string | null;
  delivery_fee_mmk: number | null;
  discount_mmk: number | null;
  items: ChatOrderExtractionItem[];
  missing_fields: string[];
};

const burmeseDigits = "၀၁၂၃၄၅၆၇၈၉";
const burmeseNumberWords: Record<string, number> = {
  တစ်: 1,
  တစ်လုံး: 1,
  တစ်ခု: 1,
  တစ်ထည်: 1,
  နှစ်: 2,
  နှစ်လုံး: 2,
  နှစ်ခု: 2,
  နှစ်ထည်: 2,
  သုံး: 3,
  သုံးလုံး: 3,
  သုံးခု: 3,
  သုံးထည်: 3,
  လေး: 4,
  လေးလုံး: 4,
  လေးခု: 4,
  ငါး: 5,
  ငါးလုံး: 5,
  ငါးခု: 5,
  ခြောက်: 6,
  ခုနစ်: 7,
  ရှစ်: 8,
  ကိုး: 9,
  ဆယ်: 10,
};

const englishNumberWords: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function normalizeDigits(value: string) {
  return [...value].map((character) => {
    const index = burmeseDigits.indexOf(character);
    return index >= 0 ? String(index) : character;
  }).join("");
}

function clean(value: string | null | undefined) {
  return value
    ?.replace(/\s+/gu, " ")
    .replace(/^[\s,၊။:;|-]+|[\s,၊။:;|-]+$/gu, "")
    .trim() || null;
}

function parseAmount(value: string | null | undefined): number | null {
  if (!value) return null;
  const digits = normalizeDigits(value).replace(/[^0-9]/g, "");
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

function parseQuantity(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = normalizeDigits(value).trim().toLowerCase();
  if (/^\d+$/.test(normalized)) {
    const quantity = Number(normalized);
    return Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 1_000_000 ? quantity : null;
  }
  return burmeseNumberWords[normalized] ?? englishNumberWords[normalized] ?? null;
}

function lastSentence(value: string) {
  const chunks = value.split(/[။.!?\n]/u).map((chunk) => chunk.trim()).filter(Boolean);
  const action = /(?:get|want|need|order|add|ယူ|လိုချင်|လုံး|ခု|ထည်)/iu;
  for (let index = chunks.length - 1; index >= 0; index -= 1) {
    const chunk = chunks[index];
    if (chunk && action.test(chunk)) return chunk;
  }
  return chunks.at(-1) ?? value;
}

function extractQuantity(value: string) {
  const labeled = value.match(/\b(?:qty|quantity|qnty)\s*[-:#=]?\s*([0-9၀-၉]+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)/iu);
  if (labeled) return { value: parseQuantity(labeled[1]), token: labeled[0] };
  const trailingX = value.match(/(?:^|\s)(x|×)\s*([0-9၀-၉]+)\b/iu);
  if (trailingX) return { value: parseQuantity(trailingX[2]), token: trailingX[0].trim() };
  const english = value.match(/\b([0-9၀-၉]+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:x|×|pcs?\.?|pieces?|items?|bags?|bottles?|sets?|ထည်|လုံး|ခု|စုံ|ဗူး|ထုပ်|ပစ္စည်း)?\b/iu);
  if (english) return { value: parseQuantity(english[1]), token: english[0] };
  const burmese = value.match(/(တစ်လုံး|တစ်ခု|တစ်ထည်|တစ်|နှစ်လုံး|နှစ်ခု|နှစ်ထည်|နှစ်|သုံးလုံး|သုံးခု|သုံးထည်|သုံး|လေးလုံး|လေးခု|လေး|ငါးလုံး|ငါးခု|ငါး|ခြောက်လုံး|ခြောက်ခု|ခြောက်|ခုနစ်လုံး|ခုနစ်ခု|ခုနစ်|ရှစ်လုံး|ရှစ်ခု|ရှစ်|ကိုးလုံး|ကိုးခု|ကိုး|ဆယ်လုံး|ဆယ်ခု|ဆယ်|[0-9၀-၉]+)\s*(?:လုံး|ခု|ထည်|စုံ|ဗူး|ထုပ်|ပစ္စည်း)?/u);
  if (burmese) return { value: parseQuantity(burmese[1]), token: burmese[0] };
  return { value: null, token: null };
}

function productFromSegment(segment: string) {
  let result = lastSentence(segment)
    .replace(/\b(?:hi|hello|hey|please|could i get|can i get|i want|i need|order|add|get|give me)\b/giu, " ")
    .replace(/(?:မင်္ဂလာပါ|ကျေးဇူးပြု၍)/gu, " ")
    .replace(/\b(?:at|for)\b.*$/iu, " ")
    .replace(/^\s*(?:each|per)\s+/iu, " ")
    .replace(/(?:တစ်လုံး|တစ်ခု|တစ်ထည်|တစ်|နှစ်လုံး|နှစ်ခု|နှစ်ထည်|နှစ်|သုံးလုံး|သုံးခု|သုံးထည်|သုံး|လေးလုံး|လေးခု|လေး|ငါးလုံး|ငါးခု|ငါး|ခြောက်|ခုနစ်|ရှစ်|ကိုး|ဆယ်)\s*(?:လုံး|ခု|ထည်)?/gu, " ");
  result = result.replace(/^\s*(?:item|product|ပစ္စည်း|ပစ္စည်းအမည်)\s*[-:#：]?\s*/iu, "");
  const quantity = extractQuantity(result);
  if (quantity.token) result = result.replace(quantity.token, " ");
  result = result.replace(/\b(?:and|&|နှင့်)\b/giu, " ");
  result = result.replace(/(?:မှာယူမယ်|မှာယူပါမယ်|မှာယူ|ယူမယ်|ယူပါမယ်|ယူ|လိုချင်တယ်|လိုချင်ပါမယ်|လိုချင်)$/u, " ");
  return clean(result);
}

function isMetadataLine(value: string) {
  return /^(?:customer|name|buyer|recipient|phone|mobile|tel|address|delivery address|shipping address|note|notes)\s*[-:#：]?/iu.test(value)
    || /^(?:အမည်|နာမည်|ဖုန်း|လိပ်စာ|ပို့ရမယ့်လိပ်စာ|ပို့မယ့်လိပ်စာ|မှတ်ချက်)\s*[-:#：]?/u.test(value)
    || /(?:ကို\s*ပို့|ပို့ပေး|cod|cash on delivery|delivery fee|ပို့ခ|ငွေလွှဲ|payment)/iu.test(value)
    || /^(?:\+?95|09|၀၉)[\d၀-၉\s-]{6,18}$/u.test(value);
}

function productSegmentFrom(value: string) {
  const segments = value.split(/\n|;|\s+(?:and|နှင့်)\s+/giu).map((segment) => segment.trim()).filter(Boolean);
  const productSegments = segments.filter((segment) => !isMetadataLine(segment));
  return productSegments.find((segment) => /(?:get|want|need|order|qty|quantity|x\s*[0-9၀-၉]|[0-9၀-၉]+\s*x|ယူ|လိုချင်|လုံး|ခု|ထည်|စုံ|ဗူး|ထုပ်|ပစ္စည်း)/iu.test(segment))
    ?? productSegments.at(-1)
    ?? value;
}

function extractItems(chat: string): ChatOrderExtractionItem[] {
  const items: ChatOrderExtractionItem[] = [];
  const pricePattern = /([0-9၀-၉][0-9၀-၉,\s]{0,20})\s*(?:mmk|kyats?|ကျပ်|ကျပ်သား)/giu;
  let match: RegExpExecArray | null;
  let cursor = 0;
  while ((match = pricePattern.exec(chat))) {
    const segment = productSegmentFrom(chat.slice(cursor, match.index));
    const quantity = extractQuantity(segment);
    items.push({
      product_name: productFromSegment(segment),
      quantity: quantity.value,
      unit_price_mmk: parseAmount(match[1]),
    });
    cursor = pricePattern.lastIndex;
  }

  if (items.length === 0) {
    const segment = productSegmentFrom(chat);
    const quantity = extractQuantity(segment);
    items.push({ product_name: productFromSegment(segment), quantity: quantity.value, unit_price_mmk: null });
  }

  return items.length > 0 ? items : [{ product_name: null, quantity: null, unit_price_mmk: null }];
}

function extractCustomer(chat: string) {
  const sender = chat.match(/^\s*([A-Za-z][A-Za-z .'’-]{1,159})\s*:\s*/u);
  const senderName = sender?.[1];
  if (senderName && !/^(?:phone|address|note|notes|name|customer)$/iu.test(senderName)) return clean(senderName);
  const english = chat.match(/(?:^|\n)\s*(?:customer|customer name|name|buyer|recipient)\s*(?:[-–—:#：]|is)?\s*([A-Za-z][A-Za-z .'’-]{1,159}?)(?=\.|,|\n|\s+(?:phone|deliver|address|note)\b|$)/imu)
    ?? chat.match(/\b(?:my\s+name\s+is|i\s+am|i['’]m)\s+([A-Za-z][A-Za-z .'’-]{1,159}?)(?=\.|,|\n|\s+(?:phone|deliver|address|note)\b|$)/iu);
  if (english) return clean(english[1]);
  const burmese = chat.match(/(?:^|\n)\s*(?:နာမည်|အမည်|ဖောက်သည်အမည်)\s*(?:က|မှာ|[-–—:#：])?\s*([^၊။\n,]{1,160})/u)
    ?? chat.match(/(?:နာမည်|အမည်|ဖောက်သည်အမည်)\s*(?:က|မှာ|[-–—:#：])?\s*([^၊။\n,]{1,160})/u);
  return clean(burmese?.[1]?.replace(/ပါ$/u, ""));
}

function extractPhone(chat: string) {
  const phone = chat.match(/(?:\+?95|09|၀၉)[\d၀-၉\s-]{6,18}/u);
  return clean(phone?.[0]) ? normalizeDigits(phone![0]).replace(/\s+/g, " ").trim() : null;
}

function extractAddress(chat: string) {
  const english = chat.match(/\b(?:deliver|ship|send)\s+(?:to|at)\s+(.+?)(?=\.|\n|\s+(?:name|phone|note|cod)\b|$)/iu)
    ?? chat.match(/(?:^|\n)\s*(?:address|delivery address|shipping address)\s*[-–—:#：]?\s*([^\n။]+?)(?=\n|$)/imu);
  if (english) return clean(english[1]);
  const labeled = chat.match(/(?:^|\n)\s*(?:လိပ်စာ|ပို့ရမယ့်လိပ်စာ|ပို့ရမည့်လိပ်စာ|ပို့မယ့်လိပ်စာ|ပို့မည့်လိပ်စာ)\s*[-–—:#：]?\s*([^\n၊။]+)/u);
  if (labeled) return clean(labeled[1]);
  const burmese = chat.match(/([^\n၊။]+?)\s*ကို\s*ပို့(?:ပေး)?(?:ပါ)?/u);
  return clean(burmese?.[1]);
}

function extractNotes(chat: string) {
  const match = chat.match(/\b(?:note|notes|remark|remarks)\s*:\s*(.+?)(?:\.|\n|$)/iu);
  return clean(match?.[1]);
}

function labeledAmount(chat: string, label: RegExp) {
  const match = chat.match(new RegExp(`${label.source}[^0-9၀-၉]{0,12}([0-9၀-၉][0-9၀-၉,\\s]{0,20})\\s*(?:mmk|kyats?|ကျပ်)?`, "iu"));
  return parseAmount(match?.[1]);
}

export function parseSimulatedChat(chat: string): ChatOrderExtraction {
  const items = extractItems(chat);
  const customer_name = extractCustomer(chat);
  const customer_phone = extractPhone(chat);
  const delivery_address = extractAddress(chat);
  const notes = extractNotes(chat);
  const delivery_fee_mmk = labeledAmount(chat, /delivery(?:\s+fee)?|ပို့ခ/iu);
  const discount_mmk = labeledAmount(chat, /discount|လျှော့/iu);
  const missing_fields: string[] = [];

  if (!customer_name) missing_fields.push("customer_name");
  if (!delivery_address) missing_fields.push("delivery_address");
  if (delivery_address && !customer_phone) missing_fields.push("customer_phone");
  if (items.some((item) => !item.product_name)) missing_fields.push("items.product_name");
  if (items.some((item) => item.quantity === null)) missing_fields.push("items.quantity");
  if (items.some((item) => item.unit_price_mmk === null)) missing_fields.push("items.unit_price_mmk");
  if (delivery_fee_mmk === null) missing_fields.push("delivery_fee_mmk");
  if (discount_mmk === null) missing_fields.push("discount_mmk");

  return {
    customer_name,
    customer_phone,
    delivery_address,
    notes,
    delivery_fee_mmk,
    discount_mmk,
    items,
    missing_fields,
  };
}

