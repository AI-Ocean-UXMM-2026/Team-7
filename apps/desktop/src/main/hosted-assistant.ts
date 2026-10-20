const hostedPaths = new Set(["/assistant", "/assistant/login"]);

function isLocalOrigin(url: URL) {
  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
}

export function resolveHostedAssistantUrl(raw: string | undefined) {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash || url.search) return null;
    if (url.protocol !== "https:" && !isLocalOrigin(url)) return null;
    if (url.pathname !== "" && url.pathname !== "/" && url.pathname !== "/assistant") return null;
    return `${url.origin}/assistant`;
  } catch {
    return null;
  }
}

export function isAllowedHostedNavigation(target: string, hostedUrl: string) {
  try {
    const targetUrl = new URL(target);
    const baseUrl = new URL(hostedUrl);
    return targetUrl.origin === baseUrl.origin && hostedPaths.has(targetUrl.pathname) && !targetUrl.username && !targetUrl.password && !targetUrl.hash;
  } catch {
    return false;
  }
}
