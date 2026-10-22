import { z } from "zod";

export const paymentReviewImageSchema = z.string().max(12_000_000).regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/u);
