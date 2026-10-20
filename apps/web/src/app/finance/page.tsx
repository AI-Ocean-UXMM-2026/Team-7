import type { Metadata } from "next";
import { PageHeading } from "@ocean/ui";
import { myanmarDate } from "@ocean/contracts";
import { BusinessSurface } from "@/components/business-surface";

export const metadata: Metadata = { title: "Finance Management" };
export default async function FinancePage({ searchParams }: { searchParams: Promise<{ tab?: string; source?: string; shop?: string }> }) {
  const { tab, source, shop } = await searchParams;
  const mode = source === "live" ? "live" : "sample";
  return <div className="page-stack"><PageHeading eyebrow="Financial clarity" title="Finance Management" description="Understand what you sold, received, spent, and earned."/>
    <BusinessSurface key={`${mode}:${shop ?? ""}:${tab ?? "reports"}`} source={mode} shopId={shop} today={myanmarDate(new Date().toISOString())} finance tab={tab === "expenses" ? "expenses" : "reports"}/>
  </div>;
}
