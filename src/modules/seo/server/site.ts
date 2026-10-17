import "@tanstack/react-start/server-only";
import { bindings } from "@/server/env";
import { websiteEnvironment } from "../metadata";
export function getPublicSite() {
  const e = bindings();
  const gaId = e.GA_MEASUREMENT_ID?.trim() || undefined;
  const umamiId = e.UMAMI_WEBSITE_ID?.trim() || undefined;
  const umamiUrl =
    e.UMAMI_SCRIPT_URL?.trim() || "https://cloud.umami.is/script.js";
  const analytics =
    gaId || umamiId
      ? {
          gaMeasurementId: gaId,
          umamiWebsiteId: umamiId,
          umamiScriptUrl: umamiUrl,
        }
      : undefined;

  return websiteEnvironment(e.APP_URL, e.APP_ENV === "production", analytics);
}
