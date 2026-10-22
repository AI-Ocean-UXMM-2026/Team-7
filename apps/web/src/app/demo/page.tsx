import type { Metadata } from "next";
import { myanmarDate } from "@ocean/contracts";
import { BusinessSurface } from "@/components/business-surface";

export const metadata: Metadata = { title: "Sample Dashboard" };

export default function DemoPage() {
  return (
      <div className="page-stack">
        <section className="demo-preview-intro" aria-labelledby="sample-title">
          <div>
            <p className="eyebrow">SYNTHETIC DATA · SAFE TO EXPLORE</p>
            <h1 id="sample-title">A clearer view of today’s shop activity</h1>
            <p>Explore sample sales, simulated receipts, expenses, and profit. Nothing here is a real transaction.</p>
          </div>
          <a className="auth-secondary" href="/login/signup">Create your workspace</a>
        </section>
        <BusinessSurface source="sample" today={myanmarDate(new Date().toISOString())} />
      </div>
  );
}
