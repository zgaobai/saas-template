import { describe, it, expect, vi } from "vitest";
vi.mock("@tanstack/react-start/server-only", () => ({}));
import {
  normalizeUserEmail,
  isDisposableEmail,
  validateEmailForRegistration,
} from "@/modules/auth/server/email-security";

describe("email normalization and alias defense", () => {
  it("normalizes Gmail dots and plus tags to identical canonical email", () => {
    const canonical = "alexander@gmail.com";
    expect(normalizeUserEmail("alexander@gmail.com")).toBe(canonical);
    expect(normalizeUserEmail("Alexander@Gmail.com")).toBe(canonical);
    expect(normalizeUserEmail("a.l.e.x.a.n.d.e.r@gmail.com")).toBe(canonical);
    expect(normalizeUserEmail("alexander+spam1@gmail.com")).toBe(canonical);
    expect(normalizeUserEmail("a.l.e.x+promo99@gmail.com")).toBe("alex@gmail.com");
    expect(normalizeUserEmail("alexander@googlemail.com")).toBe(canonical);
  });

  it("strips plus-addressing tags from Outlook, Hotmail, and iCloud", () => {
    expect(normalizeUserEmail("user+news@outlook.com")).toBe("user@outlook.com");
    expect(normalizeUserEmail("user+shopping@hotmail.com")).toBe(
      "user@hotmail.com",
    );
    expect(normalizeUserEmail("user+alias@icloud.com")).toBe("user@icloud.com");
  });

  it("preserves standard user dots for non-Google corporate domains", () => {
    expect(normalizeUserEmail("john.smith@acme-corp.com")).toBe(
      "john.smith@acme-corp.com",
    );
    expect(normalizeUserEmail("jane.doe@stanford.edu")).toBe(
      "jane.doe@stanford.edu",
    );
  });
});

describe("disposable temporary email blocking", () => {
  it("detects and blocks well-known throwaway email providers", () => {
    expect(isDisposableEmail("attacker@mailinator.com")).toBe(true);
    expect(isDisposableEmail("tempuser@temp-mail.org")).toBe(true);
    expect(isDisposableEmail("throwaway@10minutemail.com")).toBe(true);
    expect(isDisposableEmail("bot@guerrillamail.com")).toBe(true);
    expect(isDisposableEmail("fake@yopmail.com")).toBe(true);
    expect(isDisposableEmail("spammer@sharklasers.com")).toBe(true);
    expect(isDisposableEmail("sub@trashmail.com")).toBe(true);
  });

  it("detects wildcard subdomains of temporary email services", () => {
    expect(isDisposableEmail("random@subdomain.33mail.com")).toBe(true);
  });

  it("allows standard legitimate personal and business emails", () => {
    expect(isDisposableEmail("realuser@gmail.com")).toBe(false);
    expect(isDisposableEmail("work@company.com")).toBe(false);
    expect(isDisposableEmail("student@university.edu")).toBe(false);
    expect(isDisposableEmail("test@qq.com")).toBe(false);
    expect(isDisposableEmail("test@163.com")).toBe(false);
  });

  it("provides localized validation results for registration", () => {
    const reqZh = new Request("https://example.com", {
      headers: { "accept-language": "zh-CN,zh;q=0.9" },
    });
    const blockedZh = validateEmailForRegistration("bad@mailinator.com", reqZh);
    expect(blockedZh.valid).toBe(false);
    expect(blockedZh.error).toContain("不支持使用临时邮箱");

    const reqEn = new Request("https://example.com", {
      headers: { "accept-language": "en" },
    });
    const blockedEn = validateEmailForRegistration("bad@mailinator.com", reqEn);
    expect(blockedEn.valid).toBe(false);
    expect(blockedEn.error).toContain("Disposable and temporary email");

    const allowed = validateEmailForRegistration("real+alias@gmail.com");
    expect(allowed.valid).toBe(true);
    expect(allowed.normalized).toBe("real@gmail.com");
    expect(allowed.error).toBeUndefined();
  });
});
