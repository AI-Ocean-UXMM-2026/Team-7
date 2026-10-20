"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@ocean/ui";
import dolphin from "../../../../assets/dolphin/dolphin-launcher.png";

const destinations: {
  href: string;
  label: string;
  mobile: string;
  icon: IconName;
}[] = [
  { href: "/", label: "Dashboard", mobile: "Home", icon: "home" },
  { href: "/sales", label: "Sales Management", mobile: "Sales", icon: "sales" },
  {
    href: "/finance",
    label: "Finance Management",
    mobile: "Finance",
    icon: "finance",
  },
  {
    href: "/settings",
    label: "Settings",
    mobile: "Settings",
    icon: "settings",
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  if (pathname === "/login" || pathname.startsWith("/login/") || pathname.startsWith("/workspace")) {
    return <>{children}</>;
  }
  const active = (href: string) =>
    href === "/" ? pathname === href : pathname.startsWith(href);

  return (
    <div className={`app-shell${collapsed ? " is-collapsed" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Workspace sidebar">
        <div className="sidebar-top">
        <Link href="/" className="brand" aria-label="SaleSayar AI home">
          <Image className="brand-dolphin" src={dolphin} alt="" width={42} height={42}/>
          <span className="sidebar-label">
            SaleSayar AI<span className="brand-ai">BUSINESS ASSISTANT</span>
          </span>
        </Link>
        <button
          className="sidebar-toggle"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          aria-controls="desktop-navigation"
          onClick={() => setCollapsed(!collapsed)}
        >
          <Icon name="menu" />
        </button>
        </div>
        <p className="sidebar-caption sidebar-label">Workspace</p>
        <nav id="desktop-navigation" aria-label="Primary navigation">
          {destinations.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link${active(item.href) ? " active" : ""}`}
              aria-current={active(item.href) ? "page" : undefined}
              title={collapsed ? item.label : undefined}
            >
              <Icon name={item.icon} />
              <span className={collapsed ? "sr-only" : "sidebar-label"}>
                {item.label}
              </span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="avatar" aria-hidden="true">
            MT
          </span>
          <div className="sidebar-label">
            <strong>May Thu’s Shop</strong>
            <small>Shop owner</small>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <Link className="mobile-brand" href="/">
            SaleSayar AI
          </Link>
          <form action="/sales" className="topbar-search" role="search">
            <Icon name="search"/>
            <input type="search" name="q" aria-label="Search sample orders" placeholder="Search sample orders or customers…"/>
            <button type="submit" aria-label="Find sample orders">→</button>
          </form>
          <div className="topbar-right">
            <span className="language-label">
              EN <span lang="my">မြန်မာ</span>
            </span>
            <span className="workspace-tag">Sample workspace</span>
            <Link className="account-link" href="/login">Sign in</Link>
            <span className="avatar" aria-label="Sample profile: May Thu">
              MT
            </span>
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          <div className="demo-notice">
            <span className="demo-dot" aria-hidden="true" />
            <p>
              Explore with sample data. No live accounts or financial records are connected.
            </p>
          </div>
          {children}
        </main>
        <footer className="workspace-footer">
          SaleSayar AI · From Chat to Order, From Order to Profit.
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {destinations.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={active(item.href) ? "page" : undefined}
            className={active(item.href) ? "active" : ""}
          >
            <Icon name={item.icon} />
            <span>{item.mobile}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
