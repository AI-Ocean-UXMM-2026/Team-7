const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function sameOriginMutation(request: Request) {
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!origin) return request.headers.get("sec-fetch-site") === "same-origin";
  try {
    const source = new URL(origin);
    const destination = new URL(request.url);
    if (source.username || source.password) return false;
    if (source.origin === destination.origin) return true;
    const host = request.headers.get("host");
    if (host && source.host === host && source.protocol === destination.protocol) return true;
    return source.protocol === "http:" && destination.protocol === "http:"
      && loopback.has(source.hostname) && loopback.has(destination.hostname)
      && source.port === destination.port;
  } catch { return false; }
}
