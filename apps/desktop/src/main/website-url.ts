export function resolveWebsiteUrl(value: string | undefined, development = false) {
  if (!value?.trim()) {
    return development ? "http://127.0.0.1:3000/" : null;
  }

  try {
    const url = new URL(value.trim());
    if (url.username || url.password) return null;
    const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol === "http:") {
      if (!isLocalhost) return null;
    } else if (url.protocol !== "https:") {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}
