"use client";

import Image from "next/image";
import dolphin from "../../../../assets/dolphin/dolphin-accountant.png";
import { useShellLanguage } from "./shell-language";
import { shellLabels } from "@/lib/shell-ui";

export function DashboardBanner({
  userName = "Seller",
}: {
  userName?: string;
  shopId?: string;
}) {
  const { language } = useShellLanguage();
  const labels = shellLabels(language);

  const handleCreateWithAi = () => {
    window.dispatchEvent(new CustomEvent("open-saya-assistant", { detail: { view: "chat" } }));
  };
  const handleScreenshot = () => {
    window.dispatchEvent(new CustomEvent("open-saya-assistant", { detail: { view: "screenshot" } }));
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return labels.goodMorning;
    if (h < 17) return labels.goodAfternoon;
    return labels.goodEvening;
  };

  const todayFormatted = new Date().toLocaleDateString(language === "my" ? "my-MM" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <section className="ops-banner" aria-labelledby="dashboard-heading">
      <div className="ops-banner-left">
        <div className="ops-banner-greeting">
          <span className="ops-banner-eyebrow">
            {language === "my" ? "ယနေ့ ဆိုင်လုပ်ငန်း" : "TODAY AT YOUR SHOP"}
          </span>
          <h1 id="dashboard-heading">
            {getGreeting()}, {userName}!
          </h1>
          <p className="ops-banner-date">{todayFormatted}</p>
        </div>

        <div className="ops-banner-actions">
          <button
            type="button"
            onClick={handleCreateWithAi}
            className="ops-action-btn ops-action-primary"
            aria-label={labels.chatToOrder}
          >
            <span className="ops-action-icon">💬</span>
            <span>{labels.chatToOrder}</span>
          </button>
          <button
            type="button"
            onClick={handleScreenshot}
            className="ops-action-btn ops-action-secondary"
            aria-label={labels.screenshotMatch}
          >
            <span className="ops-action-icon">📷</span>
            <span>{labels.screenshotMatch}</span>
          </button>
        </div>
      </div>

      <Image
        className="ops-banner-dolphin"
        src={dolphin}
        alt="တူတူတွက်မယ် AI accountant"
        priority
        sizes="(max-width: 600px) 70px, 115px"
      />
    </section>
  );
}
