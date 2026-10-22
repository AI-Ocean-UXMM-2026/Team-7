export type ConversationMessage = {
  id: string;
  sender: string | null;
  text: string;
};

function cleanMessageLine(line: string) {
  return line
    .replace(/\s+\d{1,2}:\d{2}\s*(?:AM|PM)\s*(?:✓✓|✓)?\s*$/iu, "")
    .replace(/\s+(?:✓✓|✓)\s*$/u, "")
    .trim();
}

export function splitConversationMessages(value: string): ConversationMessage[] {
  return value
    .split(/\r?\n/u)
    .map(cleanMessageLine)
    .filter(Boolean)
    .map((line, index) => {
      const labeled = line.match(/^([^:：]{1,80})[:：]\s*(.+)$/u);
      return {
        id: `message-${index}-${line.length}`,
        sender: labeled?.[1]?.trim() || null,
        text: labeled?.[2]?.trim() || line,
      };
    });
}

export function selectedConversation(messages: ConversationMessage[], selected: ReadonlySet<string>) {
  return messages
    .filter((message) => selected.has(message.id))
    .map((message) => message.sender ? `${message.sender}: ${message.text}` : message.text)
    .join("\n");
}

const details = {
  customer_name: { my: "အမည်", en: "customer name" },
  customer_phone: { my: "ဖုန်းနံပါတ်", en: "phone number" },
  delivery_address: { my: "ပို့ဆောင်ရမည့်လိပ်စာ", en: "delivery address" },
  product_name: { my: "မှာယူမည့်ပစ္စည်း", en: "product" },
  quantity: { my: "အရေအတွက်", en: "quantity" },
  unit_price_mmk: { my: "ပစ္စည်းဈေးနှုန်း", en: "item price" },
} as const;

function detailKey(field: string): keyof typeof details | null {
  if (field.includes("product_name")) return "product_name";
  if (field.includes("quantity")) return "quantity";
  if (field.includes("unit_price_mmk")) return "unit_price_mmk";
  if (field === "customer_name" || field === "customer_phone" || field === "delivery_address") return field;
  return null;
}

function naturalList(values: string[], conjunction: string) {
  if (values.length < 2) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} ${conjunction} ${values.at(-1)}`;
}

export function buildCustomerReplies(missingFields: string[]) {
  const keys = [...new Set(missingFields.map(detailKey).filter((key): key is keyof typeof details => key !== null))];
  if (keys.length === 0) {
    return {
      my: "ကျေးဇူးတင်ပါတယ်ရှင့်။ အော်ဒါအသေးစိတ်ကို စစ်ဆေးပြီး အတည်ပြုပေးပါမယ်ရှင့်။",
      en: "Thank you. We’ll review your order details and confirm them with you shortly.",
    };
  }

  const myDetails = naturalList(keys.map((key) => details[key].my), "နှင့်");
  const enDetails = naturalList(keys.map((key) => details[key].en), "and");
  return {
    my: `အော်ဒါတင်ပေးဖို့ ${myDetails} လေး ပို့ပေးပါရှင့်။ ကျေးဇူးတင်ပါတယ်ရှင့်။`,
    en: `To place your order, please send your ${enDetails}. Thank you.`,
  };
}
