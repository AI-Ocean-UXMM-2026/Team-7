export type ReceivingAccount = { provider: string; account_name: string; last_four: string };
export type ReceiptRecipient = { provider: string | null; payee_name: string | null; payee_account?: string | null };

function clean(value: string | null | undefined) {
  return value?.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "") ?? "";
}

function providerKey(value: string | null) {
  const key = value?.normalize("NFKC").toLocaleLowerCase().replace(/[\s-]/gu, "") ?? "";
  if (["kpay", "kbzpay"].includes(key)) return "kbzpay";
  if (["wave", "wavepay", "wavemoney"].includes(key)) return "wavepay";
  if (["aya", "ayapay"].includes(key)) return "ayapay";
  if (["aplus", "apluspay", "a+", "a+pay"].includes(key)) return "apluspay";
  if (["uab", "uabpay"].includes(key)) return "uabpay";
  return key;
}

export function compareReceiptRecipient(receipt: ReceiptRecipient, accounts: ReceivingAccount[]) {
  if (!accounts.length) return { state: "not_configured" as const, message: "Add your receiving accounts in Settings to compare the receipt recipient." };
  if (!receipt.provider) return { state: "unavailable" as const, message: "The payment provider is unreadable; check the receipt and your trusted record." };
  const sameProvider = accounts.filter(account => providerKey(account.provider) === providerKey(receipt.provider));
  if (!sameProvider.length) return { state: "provider_mismatch" as const, message: "The receipt provider is not among this shop's receiving methods." };
  const name = clean(receipt.payee_name);
  const suffix = clean(receipt.payee_account).replace(/[^0-9]/gu, "").slice(-4);
  if (!name && suffix.length < 4) return { state: "unavailable" as const, message: "The recipient name and account suffix are unreadable; compare against your trusted record." };
  const matching = sameProvider.filter(account => {
    const nameMatches = !name || clean(account.account_name) === name;
    const numberMatches = suffix.length < 4 || account.last_four === suffix;
    return nameMatches && numberMatches;
  });
  if (matching.length) return { state: "consistent" as const, message: "The visible recipient details are consistent with a saved receiving account. Check your trusted record before confirming funds." };
  return { state: "recipient_mismatch" as const, message: "The visible recipient does not match this shop's saved receiving account for that provider. Review the receipt and trusted record." };
}
