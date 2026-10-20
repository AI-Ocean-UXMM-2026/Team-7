import { loadLiveBusiness, saveLiveExpense } from "./live-actions";
import type { BusinessProvider } from "./types";
export function createLiveProvider(shopId?: string): BusinessProvider {
  let activeShop = shopId;
  return { source: "live", async load() {
    const result = await loadLiveBusiness(shopId);
    if (!result.data) throw new Error(result.error ?? "Live workspace unavailable.");
    activeShop = result.data.shopId;
    return result.data;
  }, async saveExpense(input, id) {
    if (!activeShop) throw new Error("Choose your shop before saving.");
    const result = await saveLiveExpense(activeShop, input, id);
    if (!result.expense) throw new Error(result.error ?? "Expense save failed.");
    return result.expense;
  } };
}
