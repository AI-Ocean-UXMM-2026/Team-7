import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  commandSchema,
  ipcChannels,
  launcherDragSchema,
  saveDraftFieldsSchema,
  saveDraftScreenshotSchema,
  type AssistantDraft,
} from "./contract.js";
import { LauncherDragSession } from "./launcher-drag.js";

const isDevelopment = app.commandLine.hasSwitch("dev");
const devUrl = "http://127.0.0.1:5173";
const launcherSize = 106;
const panelWidth = 410;
const panelHeight = 760;

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

  window.webContents.on("will-navigate", (event, targetUrl) => {
    const isAllowed = isDevelopment
      ? new URL(targetUrl).origin === devUrl
      : targetUrl === packagedRenderer ||
        targetUrl.startsWith(`${packagedRenderer}#`);

    if (!isAllowed) event.preventDefault();
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
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

function panelUrl() {
  return isDevelopment
    ? `${devUrl}/`
    : pathToFileURL(join(__dirname, "../dist/index.html")).href;
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
  if (!panel || panel.isDestroyed()) {
    panel = createWindow(panelUrl(), {
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
      title: "SaleSayar AI Assistant · Sample workspace",
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
      order: { customer: "", product: "", quantity: "", price: "", delivery: "" },
      hasOrder: false,
      confirmed: false,
      notice: "",
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

  throw new Error("This window cannot run that assistant command.");
});

app.whenReady().then(() => {
  app.setAppUserModelId("com.salesayar.assistant.demo");
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
