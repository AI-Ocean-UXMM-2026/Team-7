export function resolveWebsiteUrl(value: string | undefined, development = false) {
  if (!value?.trim()) {
    return development ? "http://127.0.0.1:3000/" : null;
  }

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}
