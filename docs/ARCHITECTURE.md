# Architecture Specification

Version: 1.0
Primary platform: Windows 10/11

## 1. Technology Stack

- Monorepo: pnpm workspaces
- Website: Next.js, React, TypeScript
- Desktop: Electron, React, TypeScript
- Styling: Tailwind CSS
- Database: Supabase PostgreSQL
- Authentication: Supabase Auth
- File storage: Supabase private storage
- AI: Server-side text and vision-capable API
- Validation: Zod
- Charts: Recharts
- Excel export: ExcelJS
- Testing: Vitest and Playwright

Use compatible, pinned dependency versions.

## 2. Repository Architecture

apps/web:
Next.js website, server routes, authentication, Dashboard, Sales, Finance, Settings.

apps/desktop:
Electron floating launcher and compact assistant.

packages/ui:
Shared reusable interface components and design tokens.

packages/contracts:
Shared schemas, validation, and TypeScript interfaces.

packages/core:
Order totals, payment allocation rules, financial calculations, and business utilities.

supabase/migrations:
Version-controlled database migrations.

assets/dolphin:
Approved mascot illustrations.

## 3. Core Database Tables

- profiles
- shops
- shop_memberships
- customers
- products
- orders
- order_items
- order_revisions
- voucher_versions
- payment_evidence
- payments
- expenses

Every shop-owned record must be associated with a shop and protected by authorization rules.

Use Supabase Row Level Security.

## 4. API Responsibilities

Next.js server endpoints handle:

- AI chat extraction
- Order creation and updates
- Voucher generation
- Payment screenshot analysis
- Candidate order matching
- Payment verification
- Expenses
- Financial reports

Validate inputs and outputs using Zod.

Do not place private AI API keys in the browser or Electron renderer.

## 5. Business and Financial Rules

Persist monetary amounts in integer MMK units.

Draft orders do not count toward recorded sales.

Confirmed payments must be based on seller verification against trusted records.

An uploaded screenshot must not automatically change an order to paid.

Allow partial payments and prevent duplicate or excessive payment allocation.

Maintain independent order, payment, fulfillment, and payment-evidence review statuses.

Estimated profit is calculated from eligible net sales minus associated product costs and applicable operating expenses.

Estimated profit is not the same as cash received.

Define consistent treatment of discounts, refunds, cancellations, and delivery fees before implementing financial reports.

Preserve historical voucher versions and order revisions.

Use database transactions for important financial changes.

## 6. Electron Security

- Enable context isolation.
- Disable Node integration in renderer content.
- Use a restricted preload interface.
- Validate IPC messages.
- Do not expose privileged filesystem or shell operations to web content.
- Do not embed service-role keys or AI secrets.
- Do not disable browser security.
- Restrict external URLs and navigation.

## 7. Windows Floating Overlay

Use a frameless transparent Electron launcher.

The standalone dolphin image must have a transparent background.

Support:
- Always-on-top for ordinary windows where supported.
- Opening and minimizing.
- Dragging.
- Compact and expanded views.
- Resizing the expanded assistant.
- Preservation of draft input.

Test directly over a real Messenger browser window using test conversations.

Do not automatically read Messenger messages or scrape the browser.

## 8. Online and Local Demonstration

Primary:
- Hosted Next.js application.
- Online Supabase database.
- Server-side AI API.
- Electron connected to the hosted service.

Fallback:
- Locally running interface.
- Synthetic demonstration dataset.
- Predefined simulated AI responses.
- No production financial writes.
- Clear indication when simulation mode is active.

A local fallback must be independently tested. An unavailable cloud database or AI service must not silently be represented as working.

## 9. Authentication and Storage

Use secure supported authentication flows for website and Electron.

Use private storage for transaction screenshots.

Enforce shop ownership and permissions on the server and database.

Avoid sensitive data in logs.

Never commit credentials or real private financial records.

## 10. Deployment Priorities

First tested platform: Windows.

macOS and Linux remain future compatibility goals.

Do not spend MVP time building installers for untested operating systems.

The demo website should run reliably at the intended presentation resolution.

## 11. Architecture Principle

Business rules are implemented once and shared.

Electron is a companion UI, not a separate financial system.

Maintain a simple architecture suitable for a five-day buildathon.
