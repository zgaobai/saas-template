import { z } from "zod";
export const generationInput = z
  .object({
    locale: z.enum(["zh", "en"]).default("zh"),
    requestId: z.string().uuid(),
    toolId: z
      .enum([
        "copywriting",
        "rewrite",
        "summarize",
        "translate",
        "email",
        "social",
        "image",
        "video",
        "audio",
      ])
      .default("copywriting"),
    prompt: z.string().trim().min(5).max(2000),
    tone: z.enum(["自然清晰", "专业简洁", "轻松有趣"]).default("自然清晰"),
    model: z.string().trim().max(128).optional(),
    stream: z.boolean().default(false),
  })
  .strict();
