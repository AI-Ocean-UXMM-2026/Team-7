"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function DashboardScrollExperience() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // 1. Hero banner entrance
      gsap.from(".ops-banner", {
        opacity: 0.3,
        y: -12,
        duration: 0.45,
        ease: "power2.out",
        clearProps: "all",
      });

      // 2. Range filter & metrics slide reveal
      gsap.from(".range-filter, .metrics-grid .metric-card", {
        scrollTrigger: {
          trigger: ".range-filter",
          start: "top 92%",
          toggleActions: "play none none none",
        },
        opacity: 0,
        y: 18,
        stagger: 0.06,
        duration: 0.45,
        ease: "power2.out",
        clearProps: "transform,opacity",
      });

      // 3. Middle charts slide reveal
      gsap.from(".overview-middle-row .chart-card", {
        scrollTrigger: {
          trigger: ".overview-middle-row",
          start: "top 90%",
          toggleActions: "play none none none",
        },
        opacity: 0,
        y: 20,
        stagger: 0.08,
        duration: 0.5,
        ease: "power2.out",
        clearProps: "transform,opacity",
      });

      // 4. Orders ledger & rail slide reveal
      gsap.from(".overview-orders-card, .overview-rail", {
        scrollTrigger: {
          trigger: ".overview-orders-card",
          start: "top 92%",
          toggleActions: "play none none none",
        },
        opacity: 0,
        y: 22,
        stagger: 0.1,
        duration: 0.5,
        ease: "power2.out",
        clearProps: "transform,opacity",
      });
    });

    return () => ctx.revert();
  }, []);

  return null;
}
