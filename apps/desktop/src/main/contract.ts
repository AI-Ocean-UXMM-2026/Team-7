import { z } from "zod";
import { ipcChannels } from "./channels.js";
export { ipcChannels };

export const commandSchema = z
  .object({
    channel: z.literal(ipcChannels.command),
    action: z.enum(["toggle", "hide"]),
  })
  .strict();

export const launcherDragSchema = z
  .object({
    phase: z.enum(["start", "move", "end"]),
    pointerId: z.number().int().min(0).max(2_147_483_647),
    screenX: z.number().finite().min(-32_768).max(32_768),
    screenY: z.number().finite().min(-32_768).max(32_768),
  })
  .strict();

const orderSchema = z
  .object({
    customer: z.string().max(2_000),
    product: z.string().max(2_000),
    quantity: z.string().max(50),
    price: z.string().max(50),
    delivery: z.string().max(4_000),
  })
  .strict();

export const assistantDraftFieldsSchema = z
  .object({
    view: z.enum(["home", "chat", "match"]),
    chat: z.string().max(200_000),
    order: orderSchema,
    hasOrder: z.boolean(),
    confirmed: z.boolean(),
    notice: z.string().max(2_000),
  })
  .strict();

const screenshotDraftSchema = z
  .object({
    source: z.string().max(12_000_000),
    name: z.string().max(255),
  })
  .strict();

export const saveDraftFieldsSchema = z
  .object({
    channel: z.literal(ipcChannels.saveDraftFields),
    fields: assistantDraftFieldsSchema,
  })
  .strict();

export const saveDraftScreenshotSchema = z
  .object({
    channel: z.literal(ipcChannels.saveDraftScreenshot),
    screenshot: screenshotDraftSchema.nullable(),
  })
  .strict();

export type AssistantDraftFields = z.infer<typeof assistantDraftFieldsSchema>;
export type AssistantDraftScreenshot = z.infer<typeof screenshotDraftSchema>;
export type AssistantDraft = {
  fields: AssistantDraftFields;
  screenshot: AssistantDraftScreenshot | null;
};

export type AssistantBridge = {
  toggleAssistant: () => Promise<void>;
  hideAssistant: () => Promise<void>;
  launcherDrag: (gesture: z.infer<typeof launcherDragSchema>) => void;
  loadDraft: () => Promise<AssistantDraft | null>;
  saveDraftFields: (fields: AssistantDraftFields) => void;
  saveDraftScreenshot: (screenshot: AssistantDraftScreenshot | null) => void;
};
