import { z } from "zod";

export const receivingAccountInputSchema = z.object({
  shop_id: z.uuid(),
  provider: z.string().trim().min(2).max(80),
  account_name: z.string().trim().min(2).max(160),
  account_number: z.string().trim().min(4).max(80).regex(/^[0-9A-Za-z+\- ]+$/u).refine(value => (value.match(/\d/gu) ?? []).length >= 4),
}).strict();

export const receivingAccountDeleteSchema = z.object({ shop_id: z.uuid(), id: z.uuid() }).strict();
