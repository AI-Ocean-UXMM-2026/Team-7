import Image from "next/image";
import Link from "next/link";
import { myanmarDate } from "@ocean/contracts";
import { BusinessSurface } from "@/components/business-surface";
import dolphin from "../../../../assets/dolphin/dolphin-accountant.png";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ source?: string; shop?: string }> }) {
  const { source, shop } = await searchParams;
  const mode = source === "live" ? "live" : "sample";
  return (
    <div className="page-stack">
      <section className="welcome-banner" aria-labelledby="dashboard-heading">
        <div className="welcome-copy">
          <p className="eyebrow">Your business at a glance</p>
          <h1 id="dashboard-heading">Good morning{mode === "sample" ? ", May Thu" : ""}!</h1>
          <p>Your shop is making waves today.<br />Here’s a little clarity for the day ahead.</p>
          <Link href={mode === "live" ? "/workspace" : "/finance?source=sample"} className="banner-link">Explore your workspace <span aria-hidden="true">→</span></Link>
        </div>
        <Image className="welcome-dolphin" src={dolphin} alt="Blue dolphin accountant wearing glasses, holding a calculator and financial clipboard" priority sizes="(max-width: 600px) 130px, 230px"/>
      </section>
      <BusinessSurface key={`${mode}:${shop ?? ""}`} source={mode} shopId={shop} today={myanmarDate(new Date().toISOString())}/>
    </div>
  );
}
