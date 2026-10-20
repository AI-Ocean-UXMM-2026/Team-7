import type { Expense, ExpenseInput, OrderDetails, PaymentRecord } from "@ocean/contracts";

export type BusinessSnapshot = {
  source: "sample" | "live"; shopId: string; shopName: string; today: string;
  orders: OrderDetails[]; expenses: Expense[]; payments: PaymentRecord[] | null;
  productCosts: Record<string, number | null> | null; limitations: string[];
};
export interface BusinessProvider {
  readonly source: "sample" | "live";
  load(): Promise<BusinessSnapshot>;
  saveExpense(input: ExpenseInput, id?: string): Promise<Expense>;
}
export const formatMmk = (value: number | null) => value === null ? "Unavailable" : value.toLocaleString("en-US");
