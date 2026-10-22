export function canAddPaymentToOrder(amountMmk: string, orderReference: string) {
  const amount = amountMmk.trim();
  if (!/^\d+$/.test(amount)) return false;
  const parsed = Number(amount);
  return Number.isSafeInteger(parsed) && parsed > 0 && orderReference.trim().length > 0;
}
