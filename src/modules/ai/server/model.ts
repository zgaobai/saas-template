import "@tanstack/react-start/server-only";
import { createOpenAI } from "@ai-sdk/openai";
import { bindings, required } from "@/server/env";
import type { ResolvedAiConfig } from "@/modules/admin/server/ai-config";

export function textModel(resolved?: ResolvedAiConfig | null) {
  if (resolved) {
    const provider = createOpenAI({
      apiKey: resolved.apiKey,
      baseURL: resolved.baseURL,
    });
    return resolved.apiStyle === "responses"
      ? provider.responses(resolved.model)
      : provider.chat(resolved.model);
  }

  const e = bindings();
  const baseURL = e.AI_BASE_URL?.trim() || undefined;
  if (baseURL) {
    const url = new URL(baseURL);
    const local =
      e.APP_ENV === "development" &&
      ["localhost", "127.0.0.1"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error("Invalid AI service URL");
  }
  if (e.AI_API_STYLE && !["responses", "chat"].includes(e.AI_API_STYLE))
    throw new Error("Invalid AI protocol");
  const provider = createOpenAI({
    apiKey: required(e.OPENAI_API_KEY, "OPENAI_API_KEY"),
    baseURL,
  });
  const model = e.AI_MODEL?.trim() || "gpt-4o-mini";
  return e.AI_API_STYLE === "chat"
    ? provider.chat(model)
    : provider.responses(model);
}
