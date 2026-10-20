// Presentation fixtures only. These are not connected account or payment records.
export const sampleOrders = [
  { id: "SS-1048", customer: "Thiri Mon", initials: "TM", product: "2 × Mira tote bag", amount: "45,000", date: "Today, 10:32 AM", payment: "Needs review", status: "Processing" },
  { id: "SS-1047", customer: "Nandar Hlaing", initials: "NH", product: "Everyday essentials", amount: "32,500", date: "Today, 9:15 AM", payment: "Unpaid", status: "New" },
  { id: "SS-1046", customer: "Aye Thandar", initials: "AT", product: "Weekend collection", amount: "68,000", date: "Yesterday, 4:48 PM", payment: "Received", status: "Shipped" },
  { id: "SS-1045", customer: "Su Myat Noe", initials: "SM", product: "Daily carry pouch", amount: "21,000", date: "Yesterday, 2:20 PM", payment: "Unpaid", status: "Processing" },
];

export const sampleExpenses = [
  { name: "Product purchase", category: "Product costs", date: "Today", amount: "142,000" },
  { name: "Packaging supplies", category: "Packaging", date: "Today", amount: "18,500" },
  { name: "Customer deliveries", category: "Delivery", date: "Yesterday", amount: "12,000" },
  { name: "Shop promotion", category: "Marketing", date: "Yesterday", amount: "25,000" },
];
