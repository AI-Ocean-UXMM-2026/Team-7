import type { OrderDetails } from "@ocean/contracts";
import type { BusinessSnapshot } from "./types";

export type DashboardAttentionItem = {
  id: string;
  title: string;
  detail: string;
  icon: "orders" | "wallet" | "finance";
  orderId?: string;
};

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return count === 1 ? singular : pluralForm;
}

/**
 * Builds short, actionable dashboard prompts from records already loaded for
 * the selected period. It deliberately reports missing financial sources as
 * unavailable instead of deriving them from order or payment statuses.
 */
export function getDashboardAttention(
  data: Pick<BusinessSnapshot, "payments" | "productCosts">,
  orders: OrderDetails[],
): DashboardAttentionItem[] {
  const items: DashboardAttentionItem[] = [];
  const drafts = orders.filter((order) => order.order_status === "draft");
  const unpaid = orders.filter(
    (order) =>
      order.order_status === "confirmed" &&
      (order.payment_status === "unpaid" || order.payment_status === "partially_paid"),
  );
  const unfulfilled = orders.filter(
    (order) =>
      order.order_status === "confirmed" &&
      order.fulfillment_status === "unfulfilled",
  );

  if (drafts.length) {
    items.push({
      id: "draft-orders",
      title: "Review draft orders",
      detail: `${drafts.length} ${plural(drafts.length, "order")} still need seller review before confirmation.`,
      icon: "orders",
      orderId: drafts[0]?.id,
    });
  }

  if (unpaid.length) {
    items.push({
      id: "unpaid-orders",
      title: "Follow up on payments",
      detail: `${unpaid.length} ${plural(unpaid.length, "confirmed order")} are unpaid or partially paid.`,
      icon: "wallet",
      orderId: unpaid[0]?.id,
    });
  }

  if (unfulfilled.length) {
    items.push({
      id: "unfulfilled-orders",
      title: "Update fulfillment",
      detail: `${unfulfilled.length} ${plural(unfulfilled.length, "confirmed order")} are still unfulfilled.`,
      icon: "orders",
      orderId: unfulfilled[0]?.id,
    });
  }

  if (data.payments === null) {
    items.push({
      id: "missing-payments",
      title: "Receipts are unavailable",
      detail: "Connect confirmed payment records before treating money as received.",
      icon: "wallet",
    });
  }

  if (data.productCosts === null) {
    items.push({
      id: "missing-costs",
      title: "Profit estimate unavailable",
      detail: "Order product costs are not connected, so no profit number is guessed.",
      icon: "finance",
    });
  }

  return items;
}
