"use client";

import { formatMmk, type BusinessSnapshot } from "@/lib/business/types";
import type { summarizeFinancials } from "@ocean/contracts";
import type { ShellLanguage } from "@/lib/shell-ui";

type Summary = ReturnType<typeof summarizeFinancials>;

export function DigitalShopCard({
  data,
  summary,
  language,
}: {
  data: BusinessSnapshot;
  summary: Summary;
  language: ShellLanguage;
}) {
  const shopSuffix = data.shopId.slice(-4).toUpperCase();
  const confirmed = summary.confirmedPayments;

  return (
    <div className="digital-shop-card" role="region" aria-label="Shop digital wallet card">
      <div className="card-top-row">
        <div className="card-chip-symbol" aria-hidden="true">
          <span className="chip-circle chip-circle-1" />
          <span className="chip-circle chip-circle-2" />
        </div>
        <div className="card-brand-badge">
          <span className="card-pay-logo">🐬 SayarPay</span>
        </div>
      </div>

      <div className="card-number-row" aria-label={`Shop Account ending in ${shopSuffix}`}>
        <span className="card-mask-dots">••••</span>
        <span className="card-mask-dots">••••</span>
        <span className="card-mask-dots">••••</span>
        <span className="card-last-digits">{shopSuffix}</span>
      </div>

      <div className="card-bottom-row">
        <div className="card-meta-block">
          <span className="card-meta-label">VALID THRU</span>
          <span className="card-meta-value">10/26</span>
        </div>
        <div className="card-meta-block card-holder-block">
          <span className="card-meta-label">CARD HOLDER</span>
          <span className="card-meta-value card-holder-name" title={data.shopName}>
            {data.shopName}
          </span>
        </div>
      </div>

      <div className="card-receipts-pill" title="Verified receipts in selected period">
        <span className="receipts-dot" />
        <span className="receipts-text">
          {language === "my" ? "ရရှိငွေ:" : "Receipts:"}{" "}
          <strong>{confirmed === null ? "—" : `${formatMmk(confirmed)} MMK`}</strong>
        </span>
      </div>
    </div>
  );
}
