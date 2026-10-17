import en from "./en.json";
export type Locale = "zh" | "en";
export const locales = ["zh", "en"] as const;
export const localeTag = (locale: Locale) => (locale === "zh" ? "zh-CN" : "en");
export function resolveLocale(
  explicit?: string | null,
  cookie?: string | null,
  acceptLanguage = "",
): Locale {
  if (explicit === "zh" || explicit === "en") return explicit;
  if (cookie === "zh" || cookie === "en") return cookie;
  const preferences = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, quality] = part.trim().split(";");
      return {
        tag: tag.toLowerCase(),
        quality: quality?.startsWith("q=") ? Number(quality.slice(2)) : 1,
        index,
      };
    })
    .filter((p) => p.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  for (const p of preferences) {
    if (p.tag === "zh" || p.tag.startsWith("zh-")) return "zh";
    if (p.tag === "en" || p.tag.startsWith("en-")) return "en";
  }
  return "en";
}
const messages = en as Record<string, string>;
const patterns = Object.entries(messages)
  .filter(([source]) => /\{\d+\}/.test(source))
  .map(([source, target]) => {
    const slots: number[] = [];
    const expression = source
      .split(/(\{\d+\})/g)
      .map((part) => {
        if (/^\{\d+\}$/.test(part)) {
          slots.push(Number(part.slice(1, -1)));
          return "(.*?)";
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("");
    return { pattern: new RegExp("^" + expression + "$", "s"), target, slots };
  });
export function translate(
  locale: Locale,
  source: string,
  values: unknown[] = [],
): string {
  let template = locale === "en" ? messages[source] : source;
  if (locale === "en" && template === undefined && source.length <= 20000) {
    for (const rule of patterns) {
      const match = rule.pattern.exec(source);
      if (match) {
        template = rule.target;
        values = [];
        rule.slots.forEach((slot, index) => (values[slot] = match[index + 1]));
        break;
      }
    }
  }
  return (template ?? source).replace(/\{(\d+)\}/g, (placeholder, index) =>
    Number(index) in values ? String(values[Number(index)]) : placeholder,
  );
}
export function createTranslator(locale: Locale) {
  function tr(source: string, values?: unknown[]): string;
  function tr<T>(source: T, values?: unknown[]): T;
  function tr(source: unknown, values: unknown[] = []) {
    return typeof source === "string"
      ? translate(locale, source, values)
      : source;
  }
  return tr;
}
export { languagePath as localizedPath } from "./routing";

export function localeFromRequest(request?: Request): Locale {
  const cookie = request?.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("qihang-locale="))
    ?.slice("qihang-locale=".length);
  return resolveLocale(
    undefined,
    cookie,
    request?.headers.get("accept-language") ?? "",
  );
}
