import "@tanstack/react-start/server-only";

const devMagicLinks = new Map<string, string>();

export function recordDevMagicLink(email: string, url: string): void {
  devMagicLinks.set(email.toLowerCase().trim(), url);
}

export function getLatestDevMagicLink(email: string): string | null {
  return devMagicLinks.get(email.toLowerCase().trim()) ?? null;
}
