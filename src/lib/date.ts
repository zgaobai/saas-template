import type { Locale } from "@/i18n/core";
export const formatDateTime = (value: number, locale: Locale = "zh") => {
  const options = { timeZone: "Asia/Shanghai" };
  const date = new Intl.DateTimeFormat(
    locale === "en" ? "en-GB" : "zh-CN",
    options,
  ).format(value);
  const time = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "zh-CN", {
    ...options,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(value);
  return `${date} ${time}`;
};
export const formatDate = (value: number, locale: Locale = "zh") =>
  new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "zh-CN", {
    timeZone: "Asia/Shanghai",
  }).format(value);
