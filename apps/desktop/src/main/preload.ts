import { contextBridge, ipcRenderer } from "electron";
import { ipcChannels } from "./channels.js";

contextBridge.exposeInMainWorld("assistant", {
  toggleAssistant: () =>
    ipcRenderer.invoke(ipcChannels.command, {
      channel: ipcChannels.command,
      action: "toggle",
    }),
  hideAssistant: () =>
    ipcRenderer.invoke(ipcChannels.command, {
      channel: ipcChannels.command,
      action: "hide",
    }),
  openWebsite: () =>
    ipcRenderer.invoke(ipcChannels.command, {
      channel: ipcChannels.command,
      action: "openWebsite",
    }),
  analyzePayment: (image: string) => ipcRenderer.invoke(ipcChannels.analyzePayment, image),
  rematchPayment: (input: unknown) => ipcRenderer.invoke(ipcChannels.rematchPayment, input),
  savePaymentEvidence: (input: unknown) => ipcRenderer.invoke(ipcChannels.savePaymentEvidence, input),
  receivingAccounts: (shopId: string) => ipcRenderer.invoke(ipcChannels.receivingAccounts, shopId),
  saveOrder: (order: unknown) => ipcRenderer.invoke(ipcChannels.saveOrder, order),
  getWebsiteUrl: () => ipcRenderer.invoke(ipcChannels.getWebsiteUrl),
  setWebsiteUrl: (url: string) => ipcRenderer.invoke(ipcChannels.setWebsiteUrl, url),
  reconnect: () => ipcRenderer.invoke(ipcChannels.reconnect),
  getShopContext: () => ipcRenderer.invoke(ipcChannels.getShopContext),
  setActiveShop: (shopId: string) => ipcRenderer.invoke(ipcChannels.setActiveShop, shopId),
  launcherDrag: (gesture: {
    phase: "start" | "move" | "end";
    pointerId: number;
    screenX: number;
    screenY: number;
  }) => ipcRenderer.send(ipcChannels.launcherDrag, gesture),
  loadDraft: () => ipcRenderer.invoke(ipcChannels.loadDraft),
  saveDraftFields: (fields: unknown) =>
    ipcRenderer.send(ipcChannels.saveDraftFields, {
      channel: ipcChannels.saveDraftFields,
      fields,
    }),
  saveDraftScreenshot: (screenshot: unknown) =>
    ipcRenderer.send(ipcChannels.saveDraftScreenshot, {
      channel: ipcChannels.saveDraftScreenshot,
      screenshot,
    }),
  readClipboardText: () => ipcRenderer.invoke(ipcChannels.readClipboardText),
  readClipboardImage: () => ipcRenderer.invoke(ipcChannels.readClipboardImage),
  writeClipboardText: (text: string) => ipcRenderer.invoke(ipcChannels.writeClipboardText, text),
});
