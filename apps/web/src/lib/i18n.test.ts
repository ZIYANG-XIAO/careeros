import { describe, expect, it } from "vitest";

import {
  applicationStatusLabel,
  formatCareerDateRange,
  formatLocaleDate,
  formatResumeVersionLabel,
  getMessageKeys,
  intlLocale,
} from "./i18n";

const enT = (key: string) => {
  const messages: Record<string, string> = {
    "applications.status.APPLIED": "Applied",
    "common.version": "Version",
    "common.unknownDate": "?",
    "common.present": "Present",
  };
  return messages[key] ?? key;
};

describe("i18n helpers", () => {
  it("maps locales to Intl-compatible tags", () => {
    expect(intlLocale("en")).toBe("en-US");
    expect(intlLocale("zh-CN")).toBe("zh-CN");
  });

  it("formats dates with explicit locale tags", () => {
    const value = "2026-09-25T01:00:00Z";
    expect(formatLocaleDate("en", value)).toMatch(/Sep/i);
    expect(formatLocaleDate("zh-CN", value)).toMatch(/2026/);
    expect(formatLocaleDate("en", null)).toBeNull();
  });

  it("localizes application status labels", () => {
    expect(applicationStatusLabel("APPLIED", enT)).toBe("Applied");
  });

  it("builds resume version labels without translating resume names", () => {
    expect(formatResumeVersionLabel("Backend Resume", 3, enT)).toBe(
      "Backend Resume · Version 3",
    );
  });

  it("formats career date ranges with localized present and unknown labels", () => {
    expect(formatCareerDateRange("2020-01", null, enT)).toBe(
      "2020-01 — Present",
    );
    expect(formatCareerDateRange(null, "2024-06", enT)).toBe("? — 2024-06");
    expect(
      formatCareerDateRange("2022-01", null, enT, { isCurrent: true }),
    ).toBe("2022-01 — Present");
    expect(
      formatCareerDateRange("2022-01", "2024-06", enT, { isCurrent: false }),
    ).toBe("2022-01 — 2024-06");
  });
});

describe("message key parity", () => {
  it("has every en key present in zh-CN", () => {
    const enKeys = getMessageKeys("en");
    const zhKeys = new Set(getMessageKeys("zh-CN"));
    const missingInZh = enKeys.filter((key) => !zhKeys.has(key));
    expect(missingInZh).toEqual([]);
  });

  it("has every zh-CN key present in en", () => {
    const zhKeys = getMessageKeys("zh-CN");
    const enKeys = new Set(getMessageKeys("en"));
    const missingInEn = zhKeys.filter((key) => !enKeys.has(key));
    expect(missingInEn).toEqual([]);
  });
});
