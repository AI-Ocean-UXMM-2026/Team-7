export function getAppUrl(): string {
  const url = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000");
  if (url.username || url.password ||
    !(url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
    throw new Error("NEXT_PUBLIC_APP_URL must be HTTPS or a local development URL.");
  }
  return url.origin;
}

// Fixed local routes and known query parameters; membership is checked by pages.
export function authDestination(next: string | null): string {
  if (!next || next.length > 1500 || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u0020]/.test(next)) return "/workspace";
  const url = new URL(next, "https://local.invalid");
  if (!["/", "/sales", "/finance", "/settings", "/workspace", "/assistant", "/login/reset-password"].includes(url.pathname)) return "/workspace";
  const params = new URLSearchParams();
  if (["/", "/sales", "/finance", "/settings", "/assistant"].includes(url.pathname)) {
    const source = url.searchParams.get("source");
    if (source === "live" || source === "sample") params.set("source", source);
    for (const name of ["shop", "order"]) {
      const value = url.searchParams.get(name);
      if (value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) params.set(name, value);
    }
    const tab = url.searchParams.get("tab");
    if (tab && ["orders", "vouchers", "payments", "expenses", "reports"].includes(tab)) params.set("tab", tab);
    const q = url.searchParams.get("q");
    if (q) params.set("q", q.slice(0, 200));
  }
  return `${url.pathname}${params.size ? `?${params}` : ""}`;
}

export function signInHref(next: string): string {
  return `/login?${new URLSearchParams({ next: authDestination(next) })}`;
}

export function assistantDestination(next: string | null): string {
  const safe = authDestination(next);
  return safe === "/assistant" || safe.startsWith("/assistant?") ? safe : "/assistant";
}

export function assistantSignInHref(next: string): string {
  return `/assistant/login?${new URLSearchParams({ next: assistantDestination(next) })}`;
}

export function shopDestination(next: string, shopId: string): string {
  const target = new URL(authDestination(next), "https://local.invalid");
  if (target.pathname === "/workspace") return `/workspace/${shopId}`;
  if (target.pathname === "/login/reset-password") return target.pathname;
  target.searchParams.set("shop", shopId);
  target.searchParams.set("source", "live");
  return `${target.pathname}?${target.searchParams}`;
}
