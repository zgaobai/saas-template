import { createLocaleRewrite } from "@/i18n/routing";
import type { Locale } from "@/i18n/core";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
export function getRouter() {
  let currentLocale: () => Locale = () => "en";
  const router = createRouter({
    rewrite: createLocaleRewrite(() => currentLocale()),
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });
  currentLocale = () =>
    router.state.location.search.lang === "zh" ? "zh" : "en";
  return router;
}
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
