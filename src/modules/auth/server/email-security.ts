import "@tanstack/react-start/server-only";
import normalize from "normalize-email";
import wildcard from "disposable-email-domains/wildcard.json" with { type: "json" };
import { createTranslator, localeFromRequest } from "@/i18n/core";

// Curated list of high-profile disposable email services and wildcard roots
const POPULAR_DISPOSABLE_DOMAINS = [
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "10minutemail.com",
  "10minutemail.net",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "guerrillamailblock.com",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "trashmail.com",
  "trashmail.net",
  "trashmail.org",
  "sharklasers.com",
  "dispostable.com",
  "chacuo.net",
  "bccto.me",
  "fakemailgenerator.com",
  "generator.email",
  "inboxkitten.com",
  "getnada.com",
  "mohmal.com",
  "mytemp.email",
  "crazymailing.com",
  "throwawaymail.com",
  "maildrop.cc",
  "nada.ltd",
  "dropmail.me",
  "emailondeck.com",
  "tempr.email",
  "internxt.com",
  "smailpro.com",
  "linshiyouxiang.net",
  "burnermail.io",
  "grr.la",
  "spam4.me",
  "24mail.ch",
];

const DISPOSABLE_SET = new Set([...wildcard, ...POPULAR_DISPOSABLE_DOMAINS]);

/**
 * Normalizes an email address to its canonical form:
 * - Strips `+alias` tags from Gmail, Outlook, Hotmail, Live, iCloud, Fastmail, Proton, etc.
 * - Removes dots (`.`) from Gmail / Googlemail usernames
 * - Normalizes `googlemail.com` to `gmail.com`
 * - Lowercases and trims
 * - Preserves standard domain dots for regular corporate/university domains
 */
export function normalizeUserEmail(rawEmail: string): string {
  const trimmed = rawEmail.trim().toLowerCase();
  let normalized = normalize(trimmed);
  const parts = normalized.split("@");
  if (parts.length === 2) {
    let [user, domain] = parts;
    if (user.includes("+")) {
      user = user.split("+")[0];
    }
    normalized = `${user}@${domain}`;
  }
  return normalized;
}

/**
 * Checks whether the email address belongs to a known temporary/disposable provider.
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return false;
  if (DISPOSABLE_SET.has(domain)) return true;
  for (const w of wildcard) {
    if (domain === w || domain.endsWith("." + w)) return true;
  }
  return false;
}

/**
 * Validates registration email against temporary domain blocklist and returns normalized email.
 */
export function validateEmailForRegistration(
  email: string,
  request?: Request,
): { valid: boolean; normalized: string; error?: string } {
  const tr = createTranslator(localeFromRequest(request));
  const normalized = normalizeUserEmail(email);
  if (isDisposableEmail(email) || isDisposableEmail(normalized)) {
    return {
      valid: false,
      normalized,
      error: tr("不支持使用临时邮箱或一次性邮箱注册，请使用常用个人或工作邮箱。"),
    };
  }
  return { valid: true, normalized };
}
