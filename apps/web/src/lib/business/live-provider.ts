import { loadLiveBusiness, saveLiveExpense } from "./live-actions";
import type { BusinessProvider, BusinessSnapshot } from "./types";

const inFlight = new Map<string, Promise<{ data?: BusinessSnapshot; error?: string; status?: number }>>();

export function createLiveProvider(shopId?: string): BusinessProvider {
  let activeShop = shopId;
  return {
    source: "live",
    async load() {
      const key = shopId ?? "default";
      let request = inFlight.get(key);
      if (!request) {
        request = loadLiveBusiness(shopId);
        inFlight.set(key, request);
        void request.finally(() => {
          setTimeout(() => {
            if (inFlight.get(key) === request) inFlight.delete(key);
          }, 300);
        });
      }
      const result = await request;
      if (!result.data) throw new Error(result.error ?? "Live workspace unavailable.");
      activeShop = result.data.shopId;
      return result.data;
    },
    async saveExpense(input, id) {
      if (!activeShop) throw new Error("Choose your shop before saving.");
      const result = await saveLiveExpense(activeShop, input, id);
      if (!result.expense) throw new Error(result.error ?? "Expense save failed.");
      return result.expense;
    },
  };
}
