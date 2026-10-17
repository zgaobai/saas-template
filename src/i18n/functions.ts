import { createServerFn } from "@tanstack/react-start";
import { resolveLocale } from "./core";
export const requestLocale = createServerFn({ method: "GET" })
  .validator((value: unknown) =>
    typeof value === "string" ? value : undefined,
  )
  .handler(async ({ data }) => {
    const { getCookie, getRequestHeader } =
      await import("@tanstack/react-start/server");
    return resolveLocale(
      data,
      getCookie("qihang-locale"),
      getRequestHeader("accept-language"),
    );
  });
