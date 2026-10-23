"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Icon } from "@ocean/ui";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface PlanItem {
  id: "free" | "pro" | "team";
  name: string;
  badge: string;
  priceMmk: number;
  periodText: string;
  targetAudience: string;
  description: string;
  features: string[];
  highlight?: boolean;
}

const freePlan: PlanItem = {
  id: "free",
  name: "FREE",
  badge: "Solo Sellers",
  priceMmk: 0,
  periodText: "Forever free",
  targetAudience: "For solo sellers",
  description: "Basic order tracking + limited AI credits to get started on Facebook & TikTok.",
  features: [
    "Basic order tracking & customer records",
    "Up to 30 Chat-to-Order AI extractions / mo",
    "Standard printable voucher generation",
    "Manual cash & bank payment logging",
    "1 Owner workspace account",
  ],
};

const proPlan: PlanItem = {
  id: "pro",
  name: "PRO",
  badge: "Most Popular · Growing Sellers",
  priceMmk: 15_000,
  periodText: "/ month · Growing sellers",
  targetAudience: "For active sellers & creators",
  description: "More AI usage, screenshot matching + finance insights for high-frequency sales.",
  features: [
    "Unlimited Chat-to-Order AI extractions",
    "Screenshot payment matching & slip verification",
    "Automated dual-language customer reply generation",
    "Finance management: net profit & expense ledger",
    "Priority Gemini AI vision & OCR extraction",
    "Direct shop exports (PNG vouchers & reports)",
  ],
  highlight: true,
};

const teamPlan: PlanItem = {
  id: "team",
  name: "TEAM",
  badge: "Small Teams",
  priceMmk: 35_000,
  periodText: "/ month · Small teams",
  targetAudience: "For small teams & multi-staff shops",
  description: "Multiple staff accounts + shared shop workflow for seamless operations.",
  features: [
    "Everything included in Pro",
    "Multiple staff accounts with Role-Based Access",
    "Shared live shop workflow across devices",
    "Workspace team invites & member management",
    "Multi-channel order aggregation (FB & TikTok)",
    "Direct priority onboarding via fourhook@gmail.org",
  ],
};

const plans: PlanItem[] = [freePlan, proPlan, teamPlan];

export function PlansView({
  shopId: _shopId,
  shopName,
}: {
  shopId?: string;
  shopName: string;
}) {
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "team">("pro");
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const activePlanDetails: PlanItem = selectedPlan === "team" ? teamPlan : proPlan;

  // GSAP ScrollTrigger entrance and scroll reveal
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Respect reduced-motion settings
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      gsap.from(".plans-clean-header", {
        opacity: 0,
        y: -14,
        duration: 0.5,
        ease: "power2.out",
      });

      gsap.from(".pricing-card", {
        scrollTrigger: {
          trigger: ".plans-cards-grid",
          start: "top 90%",
          toggleActions: "play none none none",
        },
        opacity: 0,
        y: 24,
        stagger: 0.1,
        duration: 0.6,
        ease: "power3.out",
        clearProps: "transform,opacity",
      });
    });

    return () => ctx.revert();
  }, []);

  // Close modal on Escape key
  useEffect(() => {
    if (!showBillingModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowBillingModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showBillingModal]);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("fourhook@gmail.org");
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2200);
  };

  const mailtoUrl = `mailto:fourhook@gmail.org?subject=${encodeURIComponent(
    `တူတူတွက်မယ် စာရင်းသွင်းအစီအစဉ်: ${shopName} - ${activePlanDetails.name} Plan`,
  )}&body=${encodeURIComponent(
    `မင်္ဂလာပါ တူတူတွက်မယ် အဖွဲ့သားများခင်ဗျာ/ရှင့်၊\n\nKBZPay ဖြင့် စာရင်းသွင်းကြေး ပေးသွင်းထားပါသည်။\n\nဆိုင်အမည်: ${shopName}\nအစီအစဉ်: ${activePlanDetails.name} (${activePlanDetails.priceMmk.toLocaleString()} MMK / month)\nငွေပေးချေနည်း: KBZPay QR (KHIN ZAR CHI OO - ******4086)\n\nငွေလွှဲပြေစာ screenshot ကို ပူးတွဲပေးပို့အပ်ပါသည်။\n\nကျေးဇူးတင်ပါသည်။`,
  )}`;

  return (
    <div className="plans-page-container">
      {/* Minimal clean header without unnecessary words */}
      <header className="plans-clean-header">
        <h1 className="plans-clean-title">တူတူတွက်မယ် Plans</h1>
        <p className="plans-clean-subtitle">Upgrade as your business grows</p>
      </header>

      {/* Pricing Cards Showcase Grid */}
      <section className="plans-cards-grid" aria-label="Subscription plans">
        {plans.map((plan, index) => {
          const isHighlighted = plan.highlight;
          return (
            <div
              key={plan.id}
              className={`pricing-card ${isHighlighted ? "featured-card" : ""} card-reveal-${index + 1}`}
            >
              {isHighlighted && <div className="card-popular-ribbon">⭐ MOST POPULAR</div>}

              <div className="card-header">
                <div className={`card-icon-wrap ${plan.id}`}>
                  {plan.id === "free" && <Icon name="store" size={22} />}
                  {plan.id === "pro" && <Icon name="plans" size={22} fill />}
                  {plan.id === "team" && <Icon name="users" size={22} />}
                </div>
                <div className="card-title-wrap">
                  <span className="card-plan-tag">{plan.name}</span>
                  <span className="card-audience">{plan.badge}</span>
                </div>
              </div>

              <div className="card-pricing">
                <span className="price-amount">{plan.priceMmk.toLocaleString("en-US")} MMK</span>
                <span className="price-period">{plan.periodText}</span>
              </div>

              <p className="card-description">{plan.description}</p>

              <hr className="card-divider" />

              <div className="card-features">
                <span className="features-label">Included in this plan:</span>
                <ul>
                  {plan.features.map((feat, idx) => (
                    <li key={idx}>
                      <span className="check-icon">✓</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card-action">
                {plan.id === "free" ? (
                  <button type="button" className="plan-btn current-plan-btn" disabled>
                    ✓ Current Workspace Plan
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`plan-btn ${isHighlighted ? "primary-plan-btn" : "secondary-plan-btn"}`}
                    onClick={() => {
                      setSelectedPlan(plan.id as "pro" | "team");
                      setShowBillingModal(true);
                    }}
                  >
                    Upgrade to {plan.name} ({plan.priceMmk.toLocaleString()} MMK) →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Window-in-window KBZPay Billing Modal */}
      {showBillingModal && (
        <div
          className="plans-modal-backdrop"
          onClick={() => setShowBillingModal(false)}
          role="presentation"
        >
          <div
            className="plans-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-plan-title"
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <span className="modal-badge">{activePlanDetails.name} PLAN UPGRADE</span>
                <h3 id="modal-plan-title">
                  Upgrade to {activePlanDetails.name} ({activePlanDetails.priceMmk.toLocaleString()} MMK/mo)
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowBillingModal(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-kpay-preview">
                <Image
                  src="/kpay-qr.png"
                  alt="KBZPay QR Code for တူတူတွက်မယ် Subscription"
                  width={220}
                  height={300}
                  className="modal-qr-img"
                  priority
                />
                <span className="kpay-qr-subtext">KHIN ZAR CHI OO (******4086)</span>
              </div>

              <div className="modal-instructions">
                <h4>Payment Instructions:</h4>
                <ol className="modal-steps-list">
                  <li>
                    Scan QR code with your <strong>KBZPay App</strong>
                  </li>
                  <li>
                    Transfer <strong>{activePlanDetails.priceMmk.toLocaleString()} MMK</strong>
                  </li>
                  <li>
                    Put Shop Name: <strong>{shopName}</strong> in remarks
                  </li>
                  <li>
                    Email slip to: <strong>fourhook@gmail.org</strong>
                  </li>
                </ol>

                <div className="modal-contact-row">
                  <button type="button" className="copy-email-btn" onClick={handleCopyEmail}>
                    {copiedEmail ? "✓ Copied Email!" : "📋 Copy fourhook@gmail.org"}
                  </button>
                  <a href={mailtoUrl} className="send-email-btn">
                    ✉️ Open Email App
                  </a>
                </div>

                <div className="modal-switch-plan">
                  <span>Switch plan: </span>
                  <button
                    type="button"
                    className={`switch-pill ${selectedPlan === "pro" ? "active" : ""}`}
                    onClick={() => setSelectedPlan("pro")}
                  >
                    Pro (15,000 MMK)
                  </button>
                  <button
                    type="button"
                    className={`switch-pill ${selectedPlan === "team" ? "active" : ""}`}
                    onClick={() => setSelectedPlan("team")}
                  >
                    Team (35,000 MMK)
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="modal-done-btn"
                onClick={() => setShowBillingModal(false)}
              >
                Done / Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
