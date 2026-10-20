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
});
