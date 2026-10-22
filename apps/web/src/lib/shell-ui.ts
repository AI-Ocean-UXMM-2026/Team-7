export type ShellLanguage = "en" | "my";

export const SHELL_LANGUAGE_STORAGE_KEY = "salesayar.shell-language";

const shopIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const labels = {
  en: {
    dashboard: "Dashboard",
    sales: "Sales Management",
    salesMobile: "Sales",
    finance: "Finance Management",
    financeMobile: "Finance",
    settings: "Settings",
    settingsMobile: "Settings",
    homeMobile: "Home",
    workspace: "Workspace",
    switchWorkspace: "Switch workspace",
    newOrder: "New Order",
    // Sales sub-tabs
    orders: "Orders",
    vouchers: "Vouchers",
    payments: "Payments",
    // Finance sub-tabs
    expenses: "Expenses",
    reports: "Reports",
    // Common actions
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    edit: "Edit",
    delete: "Delete",
    retry: "Retry",
    search: "Search",
    filter: "Filter",
    // Status labels
    statusPending: "Pending",
    statusConfirmed: "Confirmed",
    statusDraft: "Draft",
    statusPaid: "Paid",
    statusUnpaid: "Unpaid",
    statusDelivered: "Delivered",
    statusProcessing: "Processing",
    statusShipped: "Shipped",
    statusCancelled: "Cancelled",
    statusPartiallyPaid: "Partially Paid",
    // Metrics
    todaySales: "Today's Sales",
    confirmedToday: "Confirmed today",
    paymentsReceived: "Payments Received",
    confirmedInPeriod: "Confirmed in selected period",
    estimatedProfit: "Estimated Profit",
    netProfitAfterExpenses: "Net profit after expenses",
    totalOrders: "Total Orders",
    ordersInPeriod: "Orders in selected period",
    recordedSales: "Recorded Sales",
    confirmedPayments: "Confirmed Payments",
    operatingExpenses: "Operating Expenses",
    packagingDeliveryMarketing: "Packaging, delivery & marketing",
    salesMinusCosts: "Sales − product costs − expenses",
    // Attention & headings
    needsAttention: "Needs Attention",
    noAttention: "All clear",
    salesPerformance: "Sales Performance Overview",
    businessPerformance: "Business Performance",
    salesOverview: "Sales Overview",
    salesReceiptsTrend: "Sales, Receipts & Profit Trend",
    expenseBreakdown: "Expense Breakdown",
    monthlyFinancialSummary: "Monthly Financial Summary",
    expenseLedger: "Expense Ledger",
    addExpense: "+ Add Expense",
    // Filter presets
    presetToday: "Today",
    preset7Days: "7 days",
    preset30Days: "30 days",
    presetThisMonth: "This month",
    from: "From",
    to: "To",
    month: "Month",
    category: "Category",
    allCategories: "All categories",
    // Table headers & actions
    customer: "Customer",
    orderId: "Order ID",
    date: "Date",
    amount: "Amount",
    paymentStatus: "Payment",
    fulfillmentStatus: "Fulfillment",
    action: "Action",
    viewEdit: "View / Edit",
    createOrder: "+ Create order",
    reloadOrders: "Reload orders",
    searchOrders: "Search orders, customers or products",
    allOrderStatuses: "All order statuses",
    allPayments: "All payments",
    allFulfillment: "All fulfillment",
    newestFirst: "Newest first",
    oldestFirst: "Oldest first",
    // Banner & templates
    goodMorning: "Good morning",
    goodAfternoon: "Good afternoon",
    goodEvening: "Good evening",
    shopActive: "Shop Active",
    chatToOrder: "Chat to Order",
    screenshotMatch: "Screenshot Match",
    liveApi: "Live API",
    liveApiConnected: "Live API Connected",
    syncLive: "Refresh data",
    quickTemplates: "Operations Templates",
    voucherTemplate: "Quick Voucher Generator",
    slipVerification: "KPay Slip Verification",
    deliveryDispatch: "Delivery Dispatch",
    liveStreamBatch: "Live Stream Orders",
  },
  my: {
    dashboard: "ဒက်ရှ်ဘုတ်",
    sales: "အရောင်းစီမံခန့်ခွဲမှု",
    salesMobile: "အရောင်း",
    finance: "ဘဏ္ဍာရေးစီမံခန့်ခွဲမှု",
    financeMobile: "ဘဏ္ဍာရေး",
    settings: "ဆက်တင်များ",
    settingsMobile: "ဆက်တင်",
    homeMobile: "ပင်မ",
    workspace: "လုပ်ငန်းခွင်",
    switchWorkspace: "လုပ်ငန်းခွင်ပြောင်းရန်",
    newOrder: "အော်ဒါအသစ်",
    // Sales sub-tabs
    orders: "အော်ဒါများ",
    vouchers: "ဘောင်ချာများ",
    payments: "ငွေပေးချေမှုများ",
    // Finance sub-tabs
    expenses: "စရိတ်များ",
    reports: "အစီရင်ခံစာများ",
    // Common actions
    save: "သိမ်းဆည်းရန်",
    cancel: "မပြုလုပ်တော့ပါ",
    close: "ပိတ်ရန်",
    edit: "တည်းဖြတ်ရန်",
    delete: "ဖျက်ရန်",
    retry: "ထပ်မံကြိုးစားရန်",
    search: "ရှာဖွေရန်",
    filter: "စီစစ်ရန်",
    // Status labels
    statusPending: "စောင့်ဆိုင်းဆဲ",
    statusConfirmed: "အတည်ပြုပြီး",
    statusDraft: "မူကြမ်း",
    statusPaid: "ပေးချေပြီး",
    statusUnpaid: "မပေးချေရသေး",
    statusDelivered: "ပို့ဆောင်ပြီး",
    statusProcessing: "ဆောင်ရွက်ဆဲ",
    statusShipped: "ပို့ဆောင်ထားဆဲ",
    statusCancelled: "ပယ်ဖျက်ပြီး",
    statusPartiallyPaid: "တစ်စိတ်တစ်ပိုင်း ပေးချေပြီး",
    // Metrics
    todaySales: "ယနေ့ အရောင်း",
    confirmedToday: "ယနေ့ အတည်ပြုပြီး",
    paymentsReceived: "လက်ခံရရှိငွေ",
    confirmedInPeriod: "ရွေးချယ်ထားသော ကာလအတွင်း ရရှိငွေ",
    estimatedProfit: "ခန့်မှန်းအမြတ်",
    netProfitAfterExpenses: "အသုံးစရိတ်နုတ်ပြီး အသားတင်အမြတ်",
    totalOrders: "စုစုပေါင်း အော်ဒါ",
    ordersInPeriod: "ကာလအတွင်း အော်ဒါများ",
    recordedSales: "မှတ်တမ်းတင်ပြီး အရောင်း",
    confirmedPayments: "အတည်ပြုပြီး ရရှိငွေ",
    operatingExpenses: "လုပ်ငန်းလည်ပတ်စရိတ်",
    packagingDeliveryMarketing: "ထုပ်ပိုးမှု၊ ပို့ဆောင်ခနှင့် ကြော်ငြာစရိတ်",
    salesMinusCosts: "အရောင်း − ကုန်ကျစရိတ် − အသုံးစရိတ်",
    // Attention & headings
    needsAttention: "စစ်ဆေးရန် အချက်များ",
    noAttention: "စစ်ဆေးရန် မရှိပါ",
    salesPerformance: "အရောင်းစွမ်းဆောင်ရည် ခြုံငုံသုံးသပ်ချက်",
    businessPerformance: "လုပ်ငန်းစွမ်းဆောင်ရည်",
    salesOverview: "အရောင်းခြုံငုံသုံးသပ်ချက်",
    salesReceiptsTrend: "အရောင်း၊ ရရှိငွေနှင့် အမြတ် လားရာ",
    expenseBreakdown: "အသုံးစရိတ် ခွဲခြမ်းစိတ်ဖြာမှု",
    monthlyFinancialSummary: "လစဉ် ဘဏ္ဍာရေး အနှစ်ချုပ်",
    expenseLedger: "အသုံးစရိတ် စာရင်း",
    addExpense: "+ အသုံးစရိတ်ထည့်ရန်",
    // Filter presets
    presetToday: "ဒီနေ့",
    preset7Days: "၇ ရက်",
    preset30Days: "၃၀ ရက်",
    presetThisMonth: "ဒီလ",
    from: "မှ",
    to: "ထိ",
    month: "လ",
    category: "အမျိုးအစား",
    allCategories: "အမျိုးအစား အားလုံး",
    // Table headers & actions
    customer: "ဝယ်သူအမည်",
    orderId: "အော်ဒါနံပါတ်",
    date: "ရက်စွဲ",
    amount: "ကျသင့်ငွေ",
    paymentStatus: "ငွေပေးချေမှု",
    fulfillmentStatus: "ပို့ဆောင်မှု",
    action: "လုပ်ဆောင်ချက်",
    viewEdit: "အသေးစိတ် / ပြင်ရန်",
    createOrder: "+ အော်ဒါအသစ်",
    reloadOrders: "ပြန်လည်ရယူရန်",
    searchOrders: "အော်ဒါ၊ ဝယ်သူ၊ ဖုန်း သို့မဟုတ် ပစ္စည်းရှာရန်...",
    allOrderStatuses: "အော်ဒါအခြေအနေ အားလုံး",
    allPayments: "ငွေပေးချေမှု အားလုံး",
    allFulfillment: "ပို့ဆောင်မှု အားလုံး",
    newestFirst: "အသစ်ဆုံး အရင်",
    oldestFirst: "အဟောင်းဆုံး အရင်",
    // Banner & templates
    goodMorning: "မင်္ဂလာနံနက်ခင်းပါ",
    goodAfternoon: "မင်္ဂလာနေ့လယ်ခင်းပါ",
    goodEvening: "မင်္ဂလာညနေခင်းပါ",
    shopActive: "ဆိုင်ဖွင့်ထားသည်",
    chatToOrder: "စာဖြင့် အော်ဒါဖွင့်ရန်",
    screenshotMatch: "စလစ်စစ်ဆေးရန်",
    liveApi: "တိုက်ရိုက် API",
    liveApiConnected: "တိုက်ရိုက်ချိတ်ဆက်ထားသည်",
    syncLive: "အချက်အလက် ပြန်ယူရန်",
    quickTemplates: "လုပ်ငန်းသုံး ပုံစံပြားများ",
    voucherTemplate: "ဘောင်ချာ အမြန်ထုတ်ရန်",
    slipVerification: "KBZPay စလစ်စစ်ဆေးရန်",
    deliveryDispatch: "ပါဆယ် ပို့ဆောင်ရေး စာရင်း",
    liveStreamBatch: "လိုင်ဗ် အရောင်းအော်ဒါများ",
  },
} as const;

export function shellLabels(language: ShellLanguage) {
  return labels[language];
}

export function parseShellLanguage(value: string | null | undefined): ShellLanguage {
  return value === "my" ? "my" : "en";
}

export function createOrderSearchHref(shopId: string | null, rawQuery: string): string | null {
  const query = rawQuery.trim();
  if (!query || query.length > 200) return null;

  const params = new URLSearchParams();
  if (shopId && shopIdPattern.test(shopId)) params.set("shop", shopId);
  params.set("q", query);
  return `/sales?${params.toString()}`;
}

export function createWorkspaceSwitcherHref(pathname: string, current: URLSearchParams): string {
  const allowedPaths = new Set(["/", "/sales", "/finance", "/settings", "/assistant"]);
  const path = allowedPaths.has(pathname) ? pathname : "/";
  const next = new URLSearchParams();

  if (path === "/sales") {
    const tab = current.get("tab");
    if (tab === "vouchers" || tab === "payments") next.set("tab", tab);
    const query = current.get("q")?.trim();
    if (query && query.length <= 200) next.set("q", query);
    const order = current.get("order");
    if (order && shopIdPattern.test(order)) next.set("order", order);
  } else if (path === "/finance") {
    const tab = current.get("tab");
    if (tab === "expenses" || tab === "reports") next.set("tab", tab);
  }

  const destination = `${path}${next.size ? `?${next.toString()}` : ""}`;
  return `/workspace?${new URLSearchParams({ next: destination }).toString()}`;
}
