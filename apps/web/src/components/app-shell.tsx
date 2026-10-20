"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
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
  const liveSales = pathname.startsWith("/sales");
  const businessSurface = pathname === "/" || pathname.startsWith("/finance");
  const [collapsed, setCollapsed] = useState(false);
  if (pathname === "/login" || pathname.startsWith("/login/") || pathname.startsWith("/workspace") || pathname.startsWith("/assistant")) {
    return <>{children}</>;
  }
  return (
    <div className={`app-shell${collapsed ? " is-collapsed" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Workspace sidebar">
        <div className="sidebar-top">
        <Suspense><ContextHomeLink className="brand">
          <Image className="brand-dolphin" src={dolphin} alt="" width={42} height={42}/>
          <span className="sidebar-label">
            SaleSayar AI<span className="brand-ai">BUSINESS ASSISTANT</span>
          </span>
        </ContextHomeLink></Suspense>
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
          <Suspense fallback={<NavigationItems pathname={pathname} collapsed={collapsed}/>}><SourceNavigation pathname={pathname} collapsed={collapsed}/></Suspense>
        </nav>
        <div className="sidebar-footer">
          <span className="avatar" aria-hidden="true">
            {liveSales || businessSurface ? "SS" : "MT"}
          </span>
          <div className="sidebar-label">
            <strong>{liveSales || businessSurface ? "SaleSayar workspace" : "May Thu’s Shop"}</strong>
            <small>{liveSales ? "Shop access protected" : businessSurface ? "Your business assistant" : "Sample shop owner"}</small>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <Suspense><ContextHomeLink className="mobile-brand">
            SaleSayar AI
          </ContextHomeLink></Suspense>
          <Suspense><ShopSearch /></Suspense>
          <div className="topbar-right">
            <span className="language-label">
              EN <span lang="my">မြန်မာ</span>
            </span>
            <span className="workspace-tag">{liveSales ? "Private orders" : businessSurface ? "Business workspace" : "Sample workspace"}</span>
            <Link className="account-link" href="/workspace">My shop / sign in</Link>
            {!liveSales && !businessSurface && <span className="avatar" aria-label="Sample profile: May Thu">
              MT
            </span>}
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          {!liveSales && !businessSurface && <div className="demo-notice">
            <span className="demo-dot" aria-hidden="true" />
            <p>
              Explore with sample data. No live accounts or financial records are connected.
            </p>
          </div>}
          {children}
        </main>
        <footer className="workspace-footer">
          SaleSayar AI · From Chat to Order, From Order to Profit.
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <Suspense fallback={<NavigationItems pathname={pathname} mobile/>}><SourceNavigation pathname={pathname} mobile/></Suspense>
      </nav>
    </div>
  );
}

function SourceNavigation(props: { pathname: string; collapsed?: boolean; mobile?: boolean }) {
  const params = useSearchParams();
  const live = params.get("source") === "live" || props.pathname.startsWith("/sales");
  return <NavigationItems {...props} live={live} shop={params.get("shop") ?? undefined}/>;
}
function ContextHomeLink({ children, className }: { children: React.ReactNode; className: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const live = params.get("source") === "live" || pathname.startsWith("/sales");
  const query = new URLSearchParams({ source: live ? "live" : "sample" });
  if (params.get("shop")) query.set("shop", params.get("shop")!);
  return <Link href={`/?${query}`} className={className} aria-label="SaleSayar AI home">{children}</Link>;
}
function ShopSearch() {
  const params = useSearchParams();
  return <form action="/sales" className="topbar-search" role="search">
    <Icon name="search"/>
    {params.get("shop") && <input type="hidden" name="shop" value={params.get("shop")!}/>}
    <input type="search" name="q" aria-label="Search private shop orders" placeholder="Search your shop’s orders…"/>
    <button type="submit" aria-label="Find orders">→</button>
  </form>;
}
function NavigationItems({ pathname, collapsed, mobile, live = false, shop }: { pathname: string; collapsed?: boolean; mobile?: boolean; live?: boolean; shop?: string }) {
  return destinations.map(item => {
    const current = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    const business = item.href === "/" || item.href === "/finance" || item.href === "/settings";
    const query = live && business ? `?source=live${shop ? `&shop=${encodeURIComponent(shop)}` : ""}` : live && item.href === "/sales" && shop ? `?shop=${encodeURIComponent(shop)}` : "";
    return <Link key={item.href} href={`${item.href}${query}`} className={mobile ? current ? "active" : "" : `nav-link${current ? " active" : ""}`} aria-current={current ? "page" : undefined} aria-label={mobile ? item.label : undefined} title={!mobile && collapsed ? item.label : undefined}><Icon name={item.icon}/><span className={!mobile ? collapsed ? "sr-only" : "sidebar-label" : undefined}>{mobile ? item.mobile : item.label}</span></Link>;
  });
}
