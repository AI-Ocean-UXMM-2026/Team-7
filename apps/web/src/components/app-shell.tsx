"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon, type IconName } from "@ocean/ui";
import { SayaAssistant } from "./saya-assistant";
import { useShellLanguage } from "./shell-language";
import dolphin from "../../../../assets/dolphin/dolphin-launcher.png";
import { getDashboardAttention, type DashboardAttentionItem } from "@/lib/business/attention";
import { createLiveProvider } from "@/lib/business/live-provider";
import {
  createOrderSearchHref,
  createWorkspaceSwitcherHref,
  shellLabels,
  type ShellLanguage,
} from "@/lib/shell-ui";

type NavigationKey = "dashboard" | "sales" | "finance" | "settings" | "plans";
type NavigationItem = {
  href: string;
  labelKey: NavigationKey;
  mobileKey: "homeMobile" | "salesMobile" | "financeMobile" | "settingsMobile" | "plansMobile";
  icon: IconName;
};

const destinations: NavigationItem[] = [
  { href: "/", labelKey: "dashboard", mobileKey: "homeMobile", icon: "home" },
  { href: "/sales", labelKey: "sales", mobileKey: "salesMobile", icon: "sales" },
  { href: "/finance", labelKey: "finance", mobileKey: "financeMobile", icon: "finance" },
  { href: "/plans", labelKey: "plans", mobileKey: "plansMobile", icon: "plans" },
  { href: "/settings", labelKey: "settings", mobileKey: "settingsMobile", icon: "settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { language } = useShellLanguage();

  if (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/assistant" ||
    pathname.startsWith("/assistant/") ||
    pathname === "/workspace" ||
    pathname.startsWith("/workspace/")
  ) {
    return <>{children}</>;
  }

  const homeHref = pathname === "/demo" ? "/demo" : "/";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left-zone">
            <Link href={homeHref} className="topbar-logo-btn" aria-label="တူတူတွက်မယ် - Home">
              <Image
                src={dolphin}
                alt="တူတူတွက်မယ် Dolphin Accountant"
                width={36}
                height={36}
                className="topbar-dolphin-img"
                priority
              />
            </Link>

            <nav className="topbar-nav" aria-label="Main Navigation">
              <Suspense fallback={null}>
                <SourceTopNavigation pathname={pathname} language={language} />
              </Suspense>
            </nav>
          </div>

          <div className="topbar-search-zone">
            {pathname === "/demo" ? (
              <span className="demo-shell-context">Synthetic sample dashboard</span>
            ) : (
              <Suspense fallback={<SearchFallback />}>
                <ShopSearch />
              </Suspense>
            )}
          </div>

          <div className="topbar-right-controls">
            <Suspense fallback={null}>
              <TopbarControls pathname={pathname} language={language} />
            </Suspense>
          </div>
        </header>

        <main id="main-content" className="main-content" tabIndex={-1}>
          {children}
        </main>

        <footer className="workspace-footer">
          တူတူတွက်မယ် · From Chat to Order, From Order to Profit.
        </footer>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <Suspense fallback={<NavigationItems pathname={pathname} mobile language={language} />}>
          <SourceNavigation pathname={pathname} mobile language={language} />
        </Suspense>
      </nav>

      {pathname !== "/demo" && (
        <Suspense>
          <AssistantDock />
        </Suspense>
      )}
    </div>
  );
}

function SearchFallback() {
  return (
    <form className="topbar-search" role="search" action="/sales">
      <Icon name="search" />
      <input type="search" name="q" aria-label="Search orders, customers or products" placeholder="Search..." />
      <kbd className="kbd-shortcut">Ctrl K</kbd>
      <button className="topbar-search-submit" type="submit">Search</button>
    </form>
  );
}



function ShopSearch() {
  const params = useSearchParams();
  const shopId = params.get("shop");
  const initialQuery = params.get("q") ?? "";
  return <ShopSearchForm key={`${shopId ?? ""}:${initialQuery}`} shopId={shopId} initialQuery={initialQuery} />;
}

function ShopSearchForm({ shopId, initialQuery }: { shopId: string | null; initialQuery: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [error, setError] = useState("");

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const href = createOrderSearchHref(shopId, query);
    if (!href) {
      setError(query.trim() ? "Search text must be 200 characters or fewer." : "Enter an order, customer, phone, or product to search.");
      inputRef.current?.focus();
      return;
    }
    setError("");
    router.push(href);
  };

  return (
    <form className="topbar-search" role="search" onSubmit={submit} noValidate>
      <Icon name="search" />
      <input
        ref={inputRef}
        type="search"
        name="q"
        value={query}
        maxLength={200}
        aria-label="Search orders, customers, phones or products"
        aria-invalid={!!error}
        aria-describedby={error ? "topbar-search-error" : undefined}
        placeholder="Search..."
        onChange={(event) => {
          setQuery(event.target.value);
          if (error) setError("");
        }}
      />
      <kbd className="kbd-shortcut">Ctrl K</kbd>
      <button className="topbar-search-submit" type="submit">Search</button>
      {error && <span className="topbar-search-error" id="topbar-search-error" role="alert">{error}</span>}
    </form>
  );
}

function TopbarControls({ pathname, language }: { pathname: string; language: ShellLanguage }) {
  const params = useSearchParams();
  const { setLanguage } = useShellLanguage();
  const labels = shellLabels(language);
  const workspaceHref = createWorkspaceSwitcherHref(pathname, new URLSearchParams(params.toString()));
  const shopId = params.get("shop");

  return (
    <>
      <div className="language-toggle-group" role="group" aria-label="Language selection">
        <button
          type="button"
          className={`lang-pill-btn ${language === "en" ? "is-active" : ""}`}
          onClick={() => setLanguage("en")}
          aria-pressed={language === "en"}
        >
          EN
        </button>
        <button
          type="button"
          className={`lang-pill-btn ${language === "my" ? "is-active" : ""}`}
          onClick={() => setLanguage("my")}
          aria-pressed={language === "my"}
        >
          မြန်မာ
        </button>
      </div>
      {pathname === "/demo" ? (
        <Link className="topbar-store-badge demo-sample-badge" href="/login">
          <span className="store-dot" aria-hidden="true" />
          <span className="topbar-store-name">Sample data</span>
          <span className="topbar-store-action">Sign in</span>
        </Link>
      ) : (
        <>
      <NotificationsControl key={shopId ?? "default-shop"} shopId={shopId} language={language} />
      <WorkspaceBadge href={workspaceHref} shopId={shopId} switchLabel={labels.switchWorkspace} />
      <button
        type="button"
        className="topbar-new-order-btn"
        onClick={() => window.dispatchEvent(new CustomEvent("open-saya-assistant", { detail: { view: "chat", reset: true } }))}
        aria-label={labels.newOrder}
      >
        {labels.newOrder}
      </button>
        </>
      )}
    </>
  );
}

function WorkspaceBadge({
  href,
  shopId,
  switchLabel,
}: {
  href: string;
  shopId: string | null;
  switchLabel: string;
}) {
  const provider = useMemo(() => createLiveProvider(shopId ?? undefined), [shopId]);
  const [shopName, setShopName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    provider.load()
      .then((snapshot) => {
        if (active) setShopName(snapshot.shopName);
      })
      .catch(() => {
        if (active) setShopName(null);
      });
    return () => {
      active = false;
    };
  }, [provider]);

  return (
    <Link
      className="topbar-store-badge"
      href={href}
      aria-label={`Current shop: ${shopName ?? "Loading shop"}. ${switchLabel}`}
      title={switchLabel}
    >
      <span className="store-dot" aria-hidden="true" />
      <span className="topbar-store-name">{shopName ?? "Loading shop…"}</span>
      <span className="topbar-store-action">Switch ▾</span>
    </Link>
  );
}

function NotificationsControl({ shopId, language }: { shopId: string | null; language: ShellLanguage }) {
  const provider = useMemo(() => createLiveProvider(shopId ?? undefined), [shopId]);
  const [open, setOpen] = useState(false);
  const [loadState, setLoadState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; items: DashboardAttentionItem[]; shopId: string }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const requestVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoadState({ status: "loading" });
    try {
      const data = await provider.load();
      if (version === requestVersion.current) {
        setLoadState({ status: "ready", items: getDashboardAttention(data, data.orders), shopId: data.shopId });
      }
    } catch (cause) {
      if (version === requestVersion.current) {
        setLoadState({
          status: "error",
          message: cause instanceof Error ? cause.message : "Workspace attention could not be loaded. Retry.",
        });
      }
    }
  }, [provider]);

  useEffect(() => {
    let active = true;
    provider.load()
      .then((data) => {
        if (active) {
          setLoadState({ status: "ready", items: getDashboardAttention(data, data.orders), shopId: data.shopId });
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [provider]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const activeShopId = loadState.status === "ready" ? loadState.shopId : shopId;
  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (loadState.status === "idle") void load();
  };
  const linkForItem = (item: DashboardAttentionItem) => {
    if (!activeShopId) return "/sales";
    const params = new URLSearchParams({ shop: activeShopId });
    if (item.orderId) {
      params.set("order", item.orderId);
      return `/sales?${params.toString()}`;
    }
    return `/finance?${params.toString()}`;
  };

  const hasAttention = loadState.status === "ready" && loadState.items.length > 0;

  return (
    <div className="notification-control" ref={rootRef}>
      <button
        type="button"
        className="topbar-icon-btn"
        aria-label={`Notifications and workspace attention${hasAttention ? ` (${loadState.items.length} items need review)` : ""}`}
        aria-expanded={open}
        aria-controls={open ? "workspace-attention-panel" : undefined}
        onClick={toggle}
        ref={triggerRef}
      >
        <Icon name="bell" />
        {hasAttention && <span className="topbar-bell-dot" aria-hidden="true" />}
      </button>
      {open && (
        <section
          className="attention-panel topbar-attention-panel"
          id="workspace-attention-panel"
          aria-labelledby="workspace-attention-title"
          aria-busy={loadState.status === "loading"}
        >
          <div className="attention-panel-heading">
            <div>
              <h2 id="workspace-attention-title">
                {language === "my" ? "စစ်ဆေးရန် အချက်များ" : "Needs attention"}
              </h2>
              <p>
                {language === "my" ? "ဆိုင်မှတ်တမ်းများအပေါ် အခြေခံသည်" : "Based on current shop records."}
              </p>
            </div>
            <button
              type="button"
              className="attention-refresh-btn"
              onClick={() => void load()}
              disabled={loadState.status === "loading"}
            >
              {loadState.status === "loading"
                ? (language === "my" ? "ရယူနေသည်…" : "Loading…")
                : (language === "my" ? "ပြန်လည်စစ်ဆေးရန်" : "Refresh")}
            </button>
          </div>
          {loadState.status === "idle" || loadState.status === "loading" ? (
            <p className="attention-state" role="status">
              {language === "my" ? "မှတ်တမ်းများကို ရယူနေပါသည်…" : "Loading current records…"}
            </p>
          ) : loadState.status === "error" ? (
            <div className="attention-state" role="alert">
              <p>{loadState.message}</p>
              <button type="button" className="text-button" onClick={() => void load()}>
                {language === "my" ? "ထပ်မံကြိုးစားရန်" : "Retry loading"}
              </button>
            </div>
          ) : loadState.items.length === 0 ? (
            <p className="attention-state" role="status">
              {language === "my"
                ? "လက်ရှိ စစ်ဆေးရန် အော်ဒါ သို့မဟုတ် ဘဏ္ဍာရေး မှတ်တမ်း မရှိပါ။"
                : "No orders or financial records need attention right now."}
            </p>
          ) : (
            <ul className="topbar-attention-list">
              {loadState.items.map((item) => {
                const isHigh = item.id.includes("unpaid") || item.id.includes("draft");
                return (
                  <li key={item.id} className="topbar-attention-item">
                    <Link
                      href={linkForItem(item)}
                      className="topbar-attention-link"
                      onClick={() => setOpen(false)}
                    >
                      <div className={`topbar-attention-badge ${isHigh ? "is-warning" : "is-info"}`}>
                        <Icon name={item.icon === "orders" ? "sales" : item.icon === "wallet" ? "finance" : "home"} />
                      </div>
                      <div className="topbar-attention-content">
                        <strong className="topbar-attention-title">{item.title}</strong>
                        <span className="topbar-attention-detail">{item.detail}</span>
                      </div>
                      <span className="topbar-attention-action">
                        {language === "my" ? "စစ်ဆေးမည် →" : "Review →"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function AssistantDock() {
  const params = useSearchParams();
  return <SayaAssistant shopId={params.get("shop") ?? undefined} />;
}

function SourceTopNavigation(props: { pathname: string; language: ShellLanguage }) {
  const params = useSearchParams();
  return <TopNavigationItems {...props} shop={params.get("shop") ?? undefined} />;
}

function TopNavigationItems({
  pathname,
  shop,
  language,
}: {
  pathname: string;
  shop?: string;
  language: ShellLanguage;
}) {
  const labels = shellLabels(language);
  const query = shop && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shop)
    ? `?shop=${encodeURIComponent(shop)}`
    : "";

  return (
    <>
      {destinations.map((item) => {
        const current = item.href === "/" ? pathname === "/" || pathname === "/demo" : pathname.startsWith(item.href);
        const href = pathname === "/demo" && item.href === "/" ? "/demo" : `${item.href}${query}`;
        const label = item.labelKey === "dashboard" ? labels.dashboard : labels[item.mobileKey];

        return (
          <Link
            key={item.href}
            href={href}
            className={`topbar-3d-link${current ? " is-active" : ""}`}
            aria-current={current ? "page" : undefined}
          >
            <span className="topbar-link-text">{label}</span>
          </Link>
        );
      })}
    </>
  );
}

function SourceNavigation(props: { pathname: string; collapsed?: boolean; mobile?: boolean; language: ShellLanguage }) {
  const params = useSearchParams();
  return <NavigationItems {...props} shop={params.get("shop") ?? undefined} />;
}

function NavigationItems({
  pathname,
  collapsed,
  mobile,
  shop,
  language,
}: {
  pathname: string;
  collapsed?: boolean;
  mobile?: boolean;
  shop?: string;
  language: ShellLanguage;
}) {
  const labels = shellLabels(language);
  const query = shop && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shop)
    ? `?shop=${encodeURIComponent(shop)}`
    : "";

  return destinations.map((item) => {
    const current = item.href === "/" ? pathname === "/" || pathname === "/demo" : pathname.startsWith(item.href);
    const href = pathname === "/demo" && item.href === "/" ? "/demo" : `${item.href}${query}`;
    const label = labels[item.labelKey];
    const mobileLabel = labels[item.mobileKey];
    return (
      <Link
        key={item.href}
        href={href}
        className={mobile ? (current ? "active" : "") : `nav-link${current ? " active" : ""}`}
        aria-current={current ? "page" : undefined}
        aria-label={mobile ? label : undefined}
        title={!mobile && collapsed ? label : undefined}
      >
        <Icon name={item.icon} />
        <span className={!mobile ? (collapsed ? "sr-only" : "sidebar-label") : undefined}>
          {mobile ? mobileLabel : label}
        </span>
      </Link>
    );
  });
}
