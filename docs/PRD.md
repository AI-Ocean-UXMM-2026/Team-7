# Product Requirements Document

Version: 1.0
Status: Approved MVP Specification

## 1. Project Overview

Product name: တူတူတွက်မယ်.

Buildathon: Into the AI Ocean, hosted by UXMM.

Domain: Fintech.

Scenario: Freelancer Expense Chaos.

Tagline: From Chat to Order, From Order to Profit.

The product helps Myanmar Facebook and TikTok sellers convert customer conversations into structured orders, generate vouchers, review payment screenshots, manage expenses, and understand their sales and profits.

The solution consists of:

1. A responsive Next.js business website.
2. A floating Electron desktop assistant.
3. A shared backend and database.

The primary buildathon demonstration platform is Windows.

## 2. Target Users

Myanmar Facebook and TikTok online sellers, regardless of daily order volume.

Users may be solo sellers or small teams.

English is the default interface language, with Burmese also supported.

Currency: Myanmar Kyat (MMK).

## 3. Core MVP Features

### A. AI Chat to Order

- Seller copies customer messages from Messenger and pastes them into the assistant.
- AI extracts customer name, products, quantities, prices, delivery address, and notes.
- Missing information remains missing rather than being invented.
- Seller reviews a compact order summary.
- Every field is editable, especially quantity per line item.
- Seller must explicitly approve an order before saving.
- Follow-up customer messages can propose changes to saved orders.

### B. Order and Voucher Management

- Create and edit orders.
- Search and filter orders.
- View order details, voucher, payment information, and history.
- Generate vouchers from confirmed orders.
- Preview, download, print, and share vouchers.
- Preserve previous voucher versions when orders change.

### C. Transaction Screenshot to Order Matching

- Seller uploads a payment screenshot.
- AI extracts available payment details.
- Seller can manually enter or correct transaction information.
- System suggests possible matching orders.
- Seller reviews discrepancies.
- Payment is only confirmed after seller verification using trusted payment records.
- Screenshot evidence alone never proves funds were received.

### D. Expense Management

- Add and edit expenses.
- Categorize business expenses.
- Record product costs.
- Filter expenses by date and category.
- Prevent product costs being double-counted.

### E. Dashboard and Reports

Dashboard KPIs:

1. Today's Sales.
2. Payments Received.
3. Estimated Profit.
4. Total Orders.

Include charts, date filters, financial tables, and Excel export.

Distinguish sales from confirmed payments received, outstanding amounts, expenses, and profit.

## 4. Website Navigation

Four primary destinations:

- Dashboard
- Sales Management
- Finance Management
- Settings

Sales Management contains three tabs:

- Orders
- Vouchers
- Payments

Finance Management contains two tabs:

- Expenses
- Reports

Desktop navigation uses a standard collapsible sidebar.

Mobile navigation uses a four-item bottom navigation bar.

On desktop, order details open in a right-side drawer.

On mobile, order details use a full-screen view.

## 5. Floating Desktop Assistant

The launcher is the approved blue accountant dolphin with a transparent background and no visible circular container.

The launcher floats above ordinary desktop windows where supported.

The compact assistant has exactly two main actions:

1. Chat to Order.
2. Screenshot to Order Match.

Voucher generation is available after order approval.

The assistant should support minimizing, restoring, moving, and resizing where supported.

It must preserve unsaved drafts when minimized.

## 6. Language and Design

- English default.
- Burmese selectable.
- Mobile-friendly and keyboard-accessible UI.
- Ocean-blue visual system.
- Finance Management design used as the primary consistency reference.
- Friendly, playful mascot interactions.
- Reduced-motion support.

Mascot states include welcome, thinking, swimming/loading, success, and warning.

## 7. Product Safety and Financial Rules

- AI never silently confirms an order.
- AI never independently confirms a payment.
- Unknown extracted details remain unknown.
- Financial calculations are controlled by deterministic application logic.
- Shop data is accessible only to authorized users.
- Payment screenshots are stored privately.
- Voucher and payment history must be preserved.
- Order, payment, fulfillment, and evidence-review statuses must remain separate.

## 8. Five-Day Buildathon Priorities

Day 1: UX finalization, project foundation, and Windows overlay proof of concept.

Day 2: Core order extraction, review, saving, and vouchers.

Day 3: Screenshot matching, expenses, and connected financial records.

Day 4: Electron integration, responsive UX, and meaningful mascot animation.

Day 5: Testing, stabilization, presentation, and local fallback rehearsal.

## 9. Out of Scope

- Automatic private Messenger reading.
- Automatic TikTok chat access.
- Real banking/wallet integration.
- Automatic proof of successful payment.
- Android overlay.
- Advanced COD courier settlements.
- Comprehensive tax filing.
- Complex inventory forecasting.
- Full native cross-platform certification during the buildathon.

## 10. MVP Acceptance Criteria

A successful demo must show:

1. Real Messenger conversation with synthetic data.
2. Floating dolphin opened above the browser.
3. Customer chat pasted into the assistant.
4. AI-generated draft order.
5. Manual correction and seller approval.
6. Saved order and generated voucher.
7. Screenshot matching and manual payment verification.
8. Updated financial dashboard.

The demonstration must work without unexplained developer intervention.
