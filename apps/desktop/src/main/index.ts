import {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  nativeImage,
  screen,
  session,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from "electron";
import crypto from "node:crypto";
import { z } from "zod";
import {
  paymentEvidenceSaveSchema,
  screenshotAnalyzeResponseSchema,
  screenshotMatchRequestSchema,
  screenshotMatchResponseSchema,
} from "@ocean/contracts";
import { join, resolve } from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import {
  commandSchema,
  ipcChannels,
  launcherDragSchema,
  paymentReviewImageSchema,
  saveDraftFieldsSchema,
  saveDraftScreenshotSchema,
  writeClipboardTextSchema,
  type AssistantDraft,
} from "./contract.js";
import { LauncherDragSession } from "./launcher-drag.js";
import { attachNavigationGuards } from "./navigation-guard.js";
import { resolveWebsiteUrl } from "./website-url.js";

function loadEnvFiles() {
  const candidateDirs = [
    process.cwd(),
    resolve(process.cwd(), ".."),
    resolve(process.cwd(), "../.."),
  ];
  for (const dir of candidateDirs) {
    for (const filename of [".env.local", ".env"]) {
      const fullPath = join(dir, filename);
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          for (const line of content.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx > 0) {
              const key = trimmed.slice(0, eqIdx).trim();
              let val = trimmed.slice(eqIdx + 1).trim();
              if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
              }
              if (!process.env[key]) {
                process.env[key] = val;
              }
            }
          }
        } catch {}
      }
    }
  }
}
loadEnvFiles();

const isDevelopment = app.commandLine.hasSwitch("dev");
const devUrl = "http://127.0.0.1:5173";
const launcherSize = 106;
const panelWidth = 410;
const panelHeight = 760;
const assistantPartition = "persist:salesayar-assistant";

let launcher: BrowserWindow | null = null;
let panel: BrowserWindow | null = null;
let isQuitting = false;
let assistantDraft: AssistantDraft | null = null;
const launcherDrag = new LauncherDragSession();

function preloadPath() {
  return join(__dirname, "preload.cjs");
}

function addNavigationGuard(window: BrowserWindow) {
  const packagedRenderer = pathToFileURL(
    join(__dirname, "../dist/index.html"),
  ).href;

  attachNavigationGuards(window.webContents as unknown as Parameters<typeof attachNavigationGuards>[0], {
    mode: "local",
    isDevelopment,
    devUrl,
    packagedRenderer,
  });
}

function createWindow(
  url: string,
  options: Electron.BrowserWindowConstructorOptions,
) {
  const window = new BrowserWindow({
    backgroundColor: "#00000000",
    frame: false,
    transparent: true,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: true,
    },
    ...options,
  });

  addNavigationGuard(window);
  void window.loadURL(url);
  return window;
}

function launcherUrl() {
  const url = isDevelopment
    ? `${devUrl}/?view=launcher`
    : pathToFileURL(join(__dirname, "../dist/index.html")).href +
        "?view=launcher";
  return url;
}

function panelConfig() {
  return {
    url: isDevelopment ? `${devUrl}/` : pathToFileURL(join(__dirname, "../dist/index.html")).href,
  };
}

function createLauncher() {
  const area = screen.getPrimaryDisplay().workArea;
  launcher = createWindow(launcherUrl(), {
    width: launcherSize,
    height: launcherSize,
    x: area.x + area.width - launcherSize - 22,
    y: area.y + area.height - launcherSize - 42,
    minWidth: launcherSize,
    minHeight: launcherSize,
    maxWidth: launcherSize,
    maxHeight: launcherSize,
    resizable: false,
    movable: true,
    focusable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    type: "toolbar",
  });

  launcher.setAlwaysOnTop(true, "floating");
  launcher.once("ready-to-show", () => {
    launcher?.showInactive();
  });
  launcher.on("blur", () => {
    launcherDrag.cancel();
  });
  launcher.webContents.on("render-process-gone", () => launcherDrag.cancel());
  launcher.webContents.on("did-start-navigation", () => launcherDrag.cancel());
  launcher.on("closed", () => {
    launcherDrag.cancel();
    launcher = null;
    if (!isQuitting) app.quit();
  });
}

function placePanel() {
  if (!panel || !launcher) return;
  const anchor = launcher.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: anchor.x + Math.round(anchor.width / 2),
    y: anchor.y + Math.round(anchor.height / 2),
  });
  const area = display.workArea;
  const currentSize = panel.getSize();
  const currentWidth = currentSize[0] ?? panelWidth;
  const currentHeight = currentSize[1] ?? panelHeight;
  const fittedWidth = Math.min(currentWidth, area.width - 24);
  const fittedHeight = Math.min(currentHeight, area.height - 24);
  if (fittedWidth !== currentWidth || fittedHeight !== currentHeight) {
    panel.setSize(fittedWidth, fittedHeight, false);
  }
  const x = Math.min(
    Math.max(area.x + 12, anchor.x + anchor.width - fittedWidth),
    area.x + area.width - fittedWidth - 12,
  );
  const y = Math.min(
    Math.max(area.y + 12, anchor.y + anchor.height - fittedHeight),
    area.y + area.height - fittedHeight - 12,
  );
  panel.setPosition(x, y, false);
}

function showPanel() {
  const config = panelConfig();
  if (!panel || panel.isDestroyed()) {
    panel = createWindow(config.url, {
      width: panelWidth,
      height: panelHeight,
      minWidth: 370,
      minHeight: 580,
      maxWidth: 520,
      maxHeight: 900,
      resizable: true,
      movable: true,
      skipTaskbar: true,
      alwaysOnTop: true,
      title: "တူတူတွက်မယ် Assistant",
      type: "toolbar",
    });
    panel.setAlwaysOnTop(true, "floating");
    panel.on("close", (event) => {
      event.preventDefault();
      panel?.hide();
    });
  }

  placePanel();
  if (!panel.isVisible()) panel.show();
  else panel.focus();
  panel.setAlwaysOnTop(true, "floating");
  panel.moveTop();
}

function toggleAssistant() {
  if (panel?.isVisible()) panel.hide();
  else showPanel();
}

let connectionAttempt: Promise<void> | null = null;

async function connectedSession(websiteUrl: string, target: string, force = false) {
  if (!connectionAttempt || force) {
    const attempt = establishConnectedSession(websiteUrl, target, force);
    connectionAttempt = attempt;
    void attempt.finally(() => { if (connectionAttempt === attempt) connectionAttempt = null; }).catch(() => {});
  }
  await connectionAttempt;
}

async function establishConnectedSession(websiteUrl: string, target: string, force = false) {
  const partition = session.fromPartition(assistantPartition);
  if (!force) {
    const cookies = await partition.cookies.get({ url: websiteUrl, name: "salesayar_session" });
    const prior = cookies[0];
    if (prior) {
      const response = await fetch(target, { headers: { cookie: `salesayar_session=${prior.value}` }, redirect: "manual", signal: AbortSignal.timeout(5000) }).catch(() => null);
      if (response?.ok) return;
    }
  } else {
    try {
      const cookies = await partition.cookies.get({ url: websiteUrl, name: "salesayar_session" });
      for (const c of cookies) {
        await partition.cookies.remove(websiteUrl, c.name);
      }
    } catch {}
  }
  const verifier = crypto.randomBytes(32).toString("hex");
  const challenge = crypto.createHash("sha256").update(Buffer.from(verifier, "hex")).digest("hex");

  // Local loopback listener on port 41920 for instantaneous zero-latency pairing with deployed website
  let loopbackServer: import("node:http").Server | null = null;
  let receivedToken: string | null = null;
  const loopbackPort = 41920;
  try {
    const http = await import("node:http");
    loopbackServer = http.createServer((req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }
      if (req.url && req.url.includes("/pair")) {
        const u = new URL(req.url, `http://127.0.0.1:${loopbackPort}`);
        const token = u.searchParams.get("token");
        if (token && typeof token === "string" && token.length <= 4000) {
          receivedToken = token;
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end("<html><body style='font-family:sans-serif;text-align:center;padding:40px'><h2>✓ Assistant Connected!</h2><p>You can return to your floating assistant window.</p></body></html>");
          return;
        }
      }
      res.writeHead(404);
      res.end();
    });
    loopbackServer.listen(loopbackPort, "127.0.0.1");
    loopbackServer.on("error", () => {
      loopbackServer = null;
    });
  } catch {}

  const connectPath = `/assistant/connect?challenge=${challenge}${loopbackServer ? `&port=${loopbackPort}` : ""}`;
  await shell.openExternal(new URL(connectPath, websiteUrl).href);
  const redeemUrl = new URL("/api/assistant/connect/redeem", websiteUrl).href;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (receivedToken) {
      if (loopbackServer) { try { loopbackServer.close(); } catch {} }
      await partition.cookies.set({ url: websiteUrl, name: "salesayar_session", value: receivedToken, path: "/", httpOnly: true, secure: new URL(websiteUrl).protocol === "https:", sameSite: "lax" });
      const verified = await fetch(target, { headers: { cookie: `salesayar_session=${receivedToken}` }, redirect: "manual", signal: AbortSignal.timeout(5000) }).catch(() => null);
      if (verified?.ok) return;
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
    const response = await fetch(redeemUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ verifier }), signal: AbortSignal.timeout(5000), cache: "no-store" }).catch(() => null);
    if (!response?.ok) continue;
    const payload = await response.json().catch(() => null) as { ready?: boolean; token?: string } | null;
    if (!payload?.ready || typeof payload.token !== "string" || payload.token.length > 4000) continue;
    if (loopbackServer) { try { loopbackServer.close(); } catch {} }
    await partition.cookies.set({ url: websiteUrl, name: "salesayar_session", value: payload.token, path: "/", httpOnly: true, secure: new URL(websiteUrl).protocol === "https:", sameSite: "lax" });
    const verified = await fetch(target, { headers: { cookie: `salesayar_session=${payload.token}` }, redirect: "manual", signal: AbortSignal.timeout(5000) }).catch(() => null);
    if (!verified?.ok) throw new Error("The connected session could not be verified. Try connecting again.");
    return;
  }
  if (loopbackServer) { try { loopbackServer.close(); } catch {} }
  throw new Error("Assistant connection timed out. Return to the signed-in browser and choose Connect assistant, then try again.");
}

function ownsWindow(event: IpcMainInvokeEvent, window: BrowserWindow | null) {
  return Boolean(
    window && !window.isDestroyed() && window.webContents === event.sender,
  );
}

function ownsEvent(event: IpcMainEvent, window: BrowserWindow | null) {
  return Boolean(
    window && !window.isDestroyed() && window.webContents === event.sender,
  );
}

ipcMain.on(ipcChannels.launcherDrag, (event, payload: unknown) => {
  const senderIsLauncher = ownsEvent(event, launcher);
  const gesture = launcherDragSchema.safeParse(payload);
  if (!senderIsLauncher) return;
  if (!gesture.success) return;

  const { phase, pointerId } = gesture.data;
  // DOM screenX/Y can vary with renderer scaling. Native cursor, window bounds,
  // display selection and work-area clamping all use Electron DIP coordinates.
  if (phase === "start") {
    launcherDrag.start(pointerId, screen.getCursorScreenPoint(), launcher!.getBounds());
    return;
  }
  if (phase === "end") {
    launcherDrag.end(pointerId);
    return;
  }
  if (launcher) {
    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const position = launcherDrag.move(pointerId, cursor, launcher.getBounds(), display.workArea);
    // On Windows at fractional DPI, setPosition can feed a rounded native size
    // into the next move and grow a transparent window on every event. Always
    // supply the original size as well as the position; never recycle that size.
    if (position) launcher.setBounds({ ...position, width: launcherSize, height: launcherSize }, false);
  }
});

ipcMain.handle(ipcChannels.loadDraft, (event) => {
  if (!ownsWindow(event, panel)) throw new Error("This window cannot load drafts.");
  return assistantDraft;
});

ipcMain.handle(ipcChannels.readClipboardText, async (event) => {
  if (!ownsWindow(event, panel)) throw new Error("This window cannot read the clipboard.");
  return (await clipboard.readText()).slice(0, 20_000);
});

ipcMain.handle(ipcChannels.readClipboardImage, async (event) => {
  if (!ownsWindow(event, panel)) throw new Error("This window cannot read the clipboard.");
  const entries = await clipboard.read();
  for (const entry of entries) {
    const mime = entry.types.find(type => ["image/png", "image/jpeg", "image/webp"].includes(type));
    if (!mime) continue;
    const data = await entry.getType(mime);
    if (!(data && typeof data === "object" && "arrayBuffer" in data && "size" in data)) continue;
    if (data.size === 0 || data.size > 8 * 1024 * 1024) throw new Error("The copied image exceeds 8 MiB. Choose a smaller image.");
    const bytes = Buffer.from(await data.arrayBuffer());
    return `data:${mime};base64,${bytes.toString("base64")}`;
  }
  return null;
});

const paymentContextSchema = z.object({
  shop_id: z.uuid(),
  shop_name: z.string().min(1).max(160),
  user_email: z.string().optional(),
  user_display_name: z.string().optional(),
  shops: z.array(z.object({ shop_id: z.uuid(), shop_name: z.string() })).optional(),
}).passthrough();
const savedPaymentSchema = z.object({
  evidence: z.object({ id: z.uuid(), revision: z.number().int().nonnegative(), status: z.string() }).passthrough(),
  message: z.string().min(1).max(240),
}).passthrough();

let customWebsiteUrl: string | null = null;
let activeShopId: string | null = null;

function paymentWebsiteUrl() {
  const configured = customWebsiteUrl || process.env.SALESAYAR_WEB_URL || (process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") ? process.env.NEXT_PUBLIC_APP_URL : undefined);
  const websiteUrl = resolveWebsiteUrl(configured, isDevelopment);
  if (!websiteUrl) throw new Error("The connected workspace URL is not configured.");
  return websiteUrl;
}

async function forceReconnectAssistant() {
  const websiteUrl = paymentWebsiteUrl();
  const sessionUrl = new URL("/api/assistant/session", websiteUrl).href;
  const partition = session.fromPartition(assistantPartition);
  try {
    const cookies = await partition.cookies.get({ url: websiteUrl, name: "salesayar_session" });
    for (const c of cookies) {
      await partition.cookies.remove(websiteUrl, c.name);
    }
  } catch {}
  connectionAttempt = null;
  await connectedSession(websiteUrl, sessionUrl, true);
  const contextPath = activeShopId
    ? `/api/assistant/payment-context?shop_id=${encodeURIComponent(activeShopId)}`
    : "/api/assistant/payment-context";
  const context = paymentContextSchema.parse(await paymentRequest(contextPath));
  return context;
}

async function paymentRequest(path: string, init?: RequestInit) {
  const websiteUrl = paymentWebsiteUrl();
  const sessionUrl = new URL("/api/assistant/session", websiteUrl).href;
  const partitionCookies = await session.fromPartition(assistantPartition).cookies.get({ url: websiteUrl, name: "salesayar_session" });
  const existingToken = partitionCookies[0]?.value;
  const reachable = await fetch(sessionUrl, {
    headers: existingToken ? { cookie: `salesayar_session=${existingToken}` } : {},
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
  }).then(response => response.status === 200 || response.status === 401).catch(() => false);
  if (!reachable) throw new Error("The seller workspace is unavailable. Start the website server or check its URL, then try again.");
  await connectedSession(websiteUrl, sessionUrl);
  const cookies = await session.fromPartition(assistantPartition).cookies.get({ url: websiteUrl, name: "salesayar_session" });
  const token = cookies[0]?.value;
  if (!token) throw new Error("The assistant connection expired. Connect it again from your signed-in browser.");
  const target = new URL(path, websiteUrl).href;
  const response = await fetch(target, {
    ...init,
    headers: { ...init?.headers, cookie: `salesayar_session=${token}`, origin: new URL(websiteUrl).origin },
    redirect: "manual",
    signal: AbortSignal.timeout(45_000),
    cache: "no-store",
  });
  const body = await response.text();
  if (body.length > 1_000_000) throw new Error("The payment service returned too much data.");
  let parsed: unknown;
  try { parsed = JSON.parse(body) as unknown; }
  catch { throw new Error("The payment service returned an unreadable response."); }
  if (!response.ok) {
    const message = parsed && typeof parsed === "object" && "error" in parsed && typeof parsed.error === "string" ? parsed.error : "The payment service is unavailable. Try again.";
    throw new Error(message);
  }
  return parsed;
}

function reviewedImage(payload: unknown) {
  const source = paymentReviewImageSchema.parse(payload);
  const image = nativeImage.createFromDataURL(source);
  if (image.isEmpty()) throw new Error("Choose a valid transaction image.");
  const bytes = image.toPNG();
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("Choose a transaction image under 8 MiB.");
  return new Blob([new Uint8Array(bytes)], { type: "image/png" });
}

ipcMain.handle(ipcChannels.analyzePayment, async (event, payload: unknown) => {
  if (!ownsWindow(event, panel)) throw new Error("This window cannot analyze payments.");
  const image = reviewedImage(payload);
  const contextPath = activeShopId
    ? `/api/assistant/payment-context?shop_id=${encodeURIComponent(activeShopId)}`
    : "/api/assistant/payment-context";
  const context = paymentContextSchema.parse(await paymentRequest(contextPath));
  const evidenceId = crypto.randomUUID();
  const form = new FormData();
  form.set("shop_id", context.shop_id);
  form.set("evidence_id", evidenceId);
  form.set("file", image, "transaction.png");
  const analysis = screenshotAnalyzeResponseSchema.parse(await paymentRequest("/api/ai/screenshot-to-order", { method: "POST", body: form }));
  return { ...context, evidence_id: evidenceId, analysis };
});

ipcMain.handle(ipcChannels.rematchPayment, async (event, payload: unknown) => {
  if (!ownsWindow(event, panel)) throw new Error("This window cannot match payments.");
  const request = screenshotMatchRequestSchema.parse(payload);
  const result = screenshotMatchResponseSchema.parse(await paymentRequest("/api/payment-evidence/match", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request),
  }));
  return { candidates: result.candidates, duplicate_warnings: result.duplicate_warnings, message: result.message };
});

ipcMain.handle(ipcChannels.savePaymentEvidence, async (event, payload: unknown) => {
  if (!ownsWindow(event, panel)) throw new Error("This window cannot save payment evidence.");
  const input = z.object({ image: paymentReviewImageSchema, payload: paymentEvidenceSaveSchema }).strict().parse(payload);
  if (activeShopId && input.payload.shop_id !== activeShopId) {
    input.payload.shop_id = activeShopId;
  }
  const form = new FormData();
  form.set("payload", JSON.stringify(input.payload));
  form.set("file", reviewedImage(input.image), "transaction.png");
  const result = savedPaymentSchema.parse(await paymentRequest("/api/payment-evidence", { method: "POST", body: form }));
  return { evidence_id: result.evidence.id, revision: result.evidence.revision, status: result.evidence.status, message: result.message };
});

ipcMain.handle(ipcChannels.receivingAccounts, async (event, payload: unknown) => {
  if (!ownsWindow(event, panel)) throw new Error("This window cannot read receiving accounts.");
  const shopId = z.uuid().parse(payload);
  const result = z.object({ accounts: z.array(z.object({
    id: z.uuid(), provider: z.string(), account_name: z.string(), last_four: z.string(),
  }).strict()).max(100) }).strict().parse(await paymentRequest(`/api/shop-receiving-accounts?shop_id=${encodeURIComponent(shopId)}`));
  return result.accounts;
});

ipcMain.handle(ipcChannels.saveOrder, async (event, payload: unknown) => {
  if (!ownsWindow(event, panel)) throw new Error("This window cannot save orders.");
  const contextPath = activeShopId
    ? `/api/assistant/payment-context?shop_id=${encodeURIComponent(activeShopId)}`
    : "/api/assistant/payment-context";
  const context = paymentContextSchema.parse(await paymentRequest(contextPath));
  const input = z.object({
    id: z.uuid(),
    customer_name: z.string().min(1).max(160),
    customer_phone: z.string().max(40).nullable().optional(),
    delivery_address: z.string().max(500).nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
    delivery_fee_mmk: z.number().int().min(0),
    discount_mmk: z.number().int().min(0),
    items: z.array(z.object({
      product_name: z.string().min(1).max(200),
      quantity: z.number().int().min(1),
      unit_price_mmk: z.number().int().min(0),
    })).min(1),
  }).parse(payload);

  const orderPayload = {
    shop_id: context.shop_id,
    id: input.id,
    expected_updated_at: null,
    customer_name: input.customer_name.trim(),
    customer_phone: input.customer_phone?.trim() || null,
    delivery_address: input.delivery_address?.trim() || null,
    notes: input.notes?.trim() || null,
    order_status: "confirmed" as const,
    fulfillment_status: "unfulfilled" as const,
    delivery_fee_mmk: input.delivery_fee_mmk,
    discount_mmk: input.discount_mmk,
    items: input.items.map((it) => ({
      product_name: it.product_name.trim(),
      quantity: it.quantity,
      unit_price_mmk: it.unit_price_mmk,
    })),
  };

  const response = (await paymentRequest("/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(orderPayload),
  })) as { order?: unknown; error?: string };

  if (response.error || !response.order) {
    throw new Error(response.error || "Failed to save order in workspace.");
  }

  return { order: response.order, shop_id: context.shop_id, shop_name: context.shop_name };
});

ipcMain.handle(ipcChannels.getWebsiteUrl, (event) => {
  if (!ownsWindow(event, panel)) throw new Error("Unauthorized.");
  return paymentWebsiteUrl();
});

ipcMain.handle(ipcChannels.setWebsiteUrl, async (event, url: unknown) => {
  if (!ownsWindow(event, panel)) throw new Error("Unauthorized.");
  if (typeof url !== "string" || !url.trim()) {
    customWebsiteUrl = null;
    return paymentWebsiteUrl();
  }
  const resolved = resolveWebsiteUrl(url.trim(), isDevelopment);
  if (!resolved) throw new Error("Invalid URL. Please enter an HTTPS URL or http://127.0.0.1:3000.");
  if (customWebsiteUrl !== resolved) {
    customWebsiteUrl = resolved;
    activeShopId = null;
    const partition = session.fromPartition(assistantPartition);
    try {
      const cookies = await partition.cookies.get({ url: resolved, name: "salesayar_session" });
      for (const c of cookies) {
        await partition.cookies.remove(resolved, c.name);
      }
    } catch {}
  }
  return resolved;
});

ipcMain.handle(ipcChannels.reconnect, async (event) => {
  if (!ownsWindow(event, panel)) throw new Error("Unauthorized.");
  return await forceReconnectAssistant();
});

ipcMain.handle(ipcChannels.getShopContext, async (event) => {
  if (!ownsWindow(event, panel)) throw new Error("Unauthorized.");
  const contextPath = activeShopId
    ? `/api/assistant/payment-context?shop_id=${encodeURIComponent(activeShopId)}`
    : "/api/assistant/payment-context";
  return paymentContextSchema.parse(await paymentRequest(contextPath));
});

ipcMain.handle(ipcChannels.setActiveShop, (event, shopId: unknown) => {
  if (!ownsWindow(event, panel)) throw new Error("Unauthorized.");
  if (typeof shopId === "string" && shopId.trim()) {
    activeShopId = z.uuid().parse(shopId.trim());
  } else {
    activeShopId = null;
  }
});

ipcMain.handle(ipcChannels.writeClipboardText, (event, payload: unknown) => {
  if (!ownsWindow(event, panel)) throw new Error("This window cannot write to the clipboard.");
  const text = writeClipboardTextSchema.parse(payload);
  clipboard.writeText(text);
});

ipcMain.on(ipcChannels.saveDraftFields, (event, payload: unknown) => {
  if (!ownsEvent(event, panel)) return;
  const result = saveDraftFieldsSchema.safeParse(payload);
  if (!result.success) return;
  assistantDraft = {
    fields: result.data.fields,
    screenshot: assistantDraft?.screenshot ?? null,
  };
});

ipcMain.on(ipcChannels.saveDraftScreenshot, (event, payload: unknown) => {
  if (!ownsEvent(event, panel)) return;
  const result = saveDraftScreenshotSchema.safeParse(payload);
  if (!result.success) return;
  assistantDraft = {
    fields: assistantDraft?.fields ?? {
      view: "home",
      chat: "",
      order: {
        customer_name: "",
        customer_name_source: "missing",
        customer_phone: "",
        customer_phone_source: "missing",
        delivery_address: "",
        delivery_address_source: "missing",
        notes: "",
        notes_source: "missing",
        delivery_fee_mmk: "",
        delivery_fee_mmk_source: "missing",
        discount_mmk: "",
        discount_mmk_source: "missing",
        items: [{
          key: "initial",
          product_name: "",
          product_name_source: "missing",
          quantity: "",
          quantity_source: "missing",
          unit_price_mmk: "",
          unit_price_mmk_source: "missing",
        }],
      },
      hasOrder: false,
      confirmed: false,
      orderId: null,
      notice: "",
      extractionMode: "simulation",
    },
    screenshot: result.data.screenshot,
  };
});

ipcMain.handle(ipcChannels.command, (event, payload: unknown) => {
  const command = commandSchema.safeParse(payload);
  if (!command.success) {
    throw new Error("Invalid assistant command.");
  }

  if (command.data.action === "toggle" && ownsWindow(event, launcher)) {
    toggleAssistant();
    return;
  }

  if (command.data.action === "hide" && ownsWindow(event, panel)) {
    panel?.hide();
    return;
  }

  if (command.data.action === "openWebsite" && ownsWindow(event, panel)) {
    const websiteUrl = resolveWebsiteUrl(process.env.SALESAYAR_WEB_URL, isDevelopment);
    if (!websiteUrl) throw new Error("The တူတူတွက်မယ် website URL is not configured.");
    return shell.openExternal(websiteUrl);
  }

  throw new Error("This window cannot run that assistant command.");
});

app.whenReady().then(() => {
  app.setAppUserModelId("com.salesayar.assistant");
  createLauncher();
  app.on("activate", () => {
    if (!launcher || launcher.isDestroyed()) createLauncher();
    else launcher.showInactive();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
