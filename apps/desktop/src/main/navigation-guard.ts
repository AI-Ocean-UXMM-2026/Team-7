import { isAllowedHostedNavigation } from "./hosted-assistant.ts";

export type NavigationMode = "local" | "hosted";

type NavigationEvent = { preventDefault: () => void };

export type NavigationGuardTarget = {
  on: (eventName: "will-navigate" | "will-redirect", listener: (...args: unknown[]) => void) => unknown;
  setWindowOpenHandler: (handler: () => { action: "deny" }) => unknown;
};

export type NavigationGuardOptions = {
  mode: NavigationMode;
  hostedUrl?: string;
  isDevelopment: boolean;
  devUrl: string;
  packagedRenderer: string;
};

function isNavigationEvent(value: unknown): value is NavigationEvent {
  return Boolean(value && typeof value === "object" && "preventDefault" in value && typeof value.preventDefault === "function");
}

function isAllowedNavigation(targetUrl: string, options: NavigationGuardOptions) {
  if (options.mode === "hosted" && options.hostedUrl) {
    return isAllowedHostedNavigation(targetUrl, options.hostedUrl);
  }

  return options.isDevelopment
    ? new URL(targetUrl).origin === options.devUrl
    : targetUrl === options.packagedRenderer || targetUrl.startsWith(`${options.packagedRenderer}#`);
}

function isMainFrameNavigation(eventName: "will-navigate" | "will-redirect", args: unknown[]) {
  if (eventName === "will-navigate") return args[3] !== false;
  // Electron's will-redirect signature is (event, url, isInPlace, isMainFrame, ...).
  return args[3] !== false;
}

export function attachNavigationGuards(target: NavigationGuardTarget, options: NavigationGuardOptions) {
  const guard = (eventName: "will-navigate" | "will-redirect", args: unknown[]) => {
    const event = args[0];
    const targetUrl = args[1];
    if (!isNavigationEvent(event) || typeof targetUrl !== "string" || !isMainFrameNavigation(eventName, args)) return;

    let allowed = false;
    try {
      allowed = isAllowedNavigation(targetUrl, options);
    } catch {
      allowed = false;
    }

    if (!allowed) event.preventDefault();
  };

  target.on("will-navigate", (...args) => guard("will-navigate", args));
  target.on("will-redirect", (...args) => guard("will-redirect", args));
  target.setWindowOpenHandler(() => ({ action: "deny" }));
}
