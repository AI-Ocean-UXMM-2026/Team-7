# SaleSayar AI · တူတူတွက်မယ်

> **From Chat to Order, From Order to Profit.**  
> An AI-powered business and financial assistant tailored for Myanmar online sellers on Facebook and TikTok.  
> Built for the **Into the AI Ocean Buildathon**, hosted by **UXMM**.

---

## 🐬 Introduction

Myanmar's vibrant online shopping ecosystem runs on social chat platforms like Facebook Messenger and TikTok. Sellers juggle messy chat messages, manual phone-and-address tracking, delivery coordination, and mobile wallet payment slips (KBZPay, WavePay).

**SaleSayar AI (တူတူတွက်မယ်)** bridges customer conversations and business operations through two seamless, synchronized applications:

1. **Web Workspace** — A comprehensive seller management portal for orders, vouchers, payments, expenses, and financial reporting.
2. **Floating Dolphin Assistant** — A lightweight, transparent desktop companion that floats over Messenger and TikTok to extract orders, generate vouchers, and verify bank slips in seconds.

---

## 📦 The Two Apps

### 1. Web Workspace (`apps/web`)

The central headquarters for online sellers, accessible from any web browser:

- **Dashboard**: High-level financial overview, daily revenue, active order pipeline, and actionable attention alerts.
- **Sales Management**:
  - **Orders**: Full order lifecycle (Draft, Confirmed, Shipped, Delivered, Cancelled) with multi-item calculations.
  - **Vouchers**: Professional, branded vouchers formatted in Burmese or English, ready for one-click print or PNG download.
  - **Payments**: Audit trail of confirmed mobile payments and pending payment slip reviews.
- **Finance Management**:
  - **Expenses**: Categorized operational expenses (packaging, inventory, delivery, marketing).
  - **Reports**: Profit & loss summaries and cash flow insights.
- **Settings**: Receiving account setup (KBZPay, WavePay, AYA, CB Bank), multi-shop switching, and team access delegation.

### 2. Floating Dolphin Assistant (`apps/desktop`)

An Electron-powered floating desktop assistant with our friendly accountant dolphin:

- **Chat to Order**:
  - **📋 Paste from Clipboard**: Copy customer chats from Facebook Messenger or TikTok; AI extracts customer name, multiple phone numbers, delivery address, products, quantity, unit price, delivery fee, and notes.
  - **✏️ Write Order**: Direct quick-write box to compose or append follow-up customer messages without extra navigation.
  - **Instant Voucher Preview**: Clean SVG action bar (Edit, Save, Print) with single-language customer replies generated automatically based on customer language.
- **Match Payment to Order**:
  - Drag-and-drop or clipboard paste mobile banking transaction screenshots (KBZPay, WavePay).
  - Vision AI extracts transaction reference numbers, amounts, and sender names, automatically matching them with pending customer orders.
  - Seller-in-the-loop verification protects against forged receipts.
- **Real-Time Workspace Sync**:
  - Synchronizes seamlessly with your active shop account, whether running locally on your laptop (`http://127.0.0.1:3000`) or hosted on Vercel.

---

## 🚀 How to Run on Your Laptop

### Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: `v22.0.0` or higher (certified on `v24.x`)
- **pnpm**: `v11.25.0` or higher (`npm install -g pnpm`)
- **Git**

---

### Step 1: Clone & Install Dependencies

```powershell
# Clone the repository
git clone https://github.com/AI-Ocean-UXMM-2026/Team-7.git
cd ocean-ai-assistant

# Install workspace dependencies
pnpm install
```

---

### Step 2: Environment Configuration

Create a `.env.local` file in the root directory (or use `.env.example` as a template):

```ini
# Application URL
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000

# Session Secret (random 64-char hex)
SESSION_SECRET=a8f4c92e1b7305d6849e21f7c35a09b8d4e6f21789c03b54a1d7e2f5b8c9a3d4

# AI Vision & Chat (Gemini API)
AI_API_KEY=your_gemini_api_key_here
AI_CHAT_API_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
AI_CHAT_MODEL=gemini-3.5-flash-lite

AI_VISION_API_KEY=your_gemini_api_key_here
AI_VISION_API_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
AI_VISION_MODEL=gemini-3.5-flash-lite

# Optional: Supabase Auth credentials (if using hosted Supabase auth)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

*(Note: In local development, the app includes fallback simulation mode for testing AI extractions and demo stores without external keys.)*

---

### Step 3: Run the Web Workspace

In your first terminal, start the Next.js development server:

```powershell
pnpm dev
```

Open your browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

You can sign in with your email or Google, create your shop, and explore the Dashboard and Sales Management.

---

### Step 4: Run the Floating Dolphin Assistant

In a **second terminal**, build and launch the Electron floating assistant:

```powershell
# Build the desktop bundles
pnpm desktop:build

# Launch the floating assistant
pnpm desktop:start
```

The small dolphin accountant will float on the edge of your screen. 
- Click the dolphin to open the assistant panel.
- Choose **Chat to Order** or **Match Payment to Order**.
- Click **Open workspace ↗** or the bottom **🔄 Reconnect** button to link the floating assistant with your browser session.

---

## 🛠️ Testing & Quality Verification

Run our automated test suites covering authentication, business logic, payment verification, and security integrity:

```powershell
# Run Web workspace unit & security tests (42 tests)
pnpm --filter @ocean/web test

# Run Desktop assistant unit tests (20 tests)
pnpm --filter @ocean/desktop test

# Run Core contracts & extraction tests (24 tests)
pnpm --filter @ocean/core test

# Typecheck the entire monorepo
pnpm typecheck

# Production build check
pnpm build
```

---

## 📂 Repository Monorepo Structure

```text
ocean-ai-assistant/
├── apps/
│   ├── web/               # Next.js 16 Web Workspace (App Router, Tailwind CSS, SSR)
│   └── desktop/           # Electron Desktop Floating Dolphin Assistant (Vite, TS)
├── packages/
│   ├── contracts/         # Shared Zod validation schemas and TypeScript contracts
│   ├── core/              # Shared pure business logic (calculations, reply generators)
│   └── ui/                # Shared UI primitives, design tokens, and icons
├── assets/
│   └── dolphin/           # Official blue accountant dolphin illustrations & icons
└── data/                  # Local SQLite database (salesayar.db)
```

---

## 👥 Buildathon Team

- **Team Name**: Team 7 (AI Ocean Buildathon, UXMM 2026)
- **License**: Private & Proprietary
