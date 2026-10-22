import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ShellLanguageProvider } from "@/components/shell-language";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Dashboard · တူတူတွက်မယ်", template: "%s · တူတူတွက်မယ်" },
  description:
    "From Chat to Order, From Order to Profit. A workspace for Myanmar online sellers.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ShellLanguageProvider>
          <AppShell>{children}</AppShell>
        </ShellLanguageProvider>
      </body>
    </html>
  );
}
