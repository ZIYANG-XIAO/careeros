import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  applicationStatusLabel,
  formatCareerDateRange,
  formatLocaleDate,
  formatResumeVersionLabel,
  getMessageKeys,
  intlLocale,
  LocaleProvider,
  useI18n,
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

function Interpolated({
  msgKey,
  params,
}: {
  msgKey: Parameters<ReturnType<typeof useI18n>["t"]>[0];
  params: Record<string, string | number>;
}) {
  const { t } = useI18n();
  return <span>{t(msgKey, params)}</span>;
}

describe("t() interpolation", () => {
  it("substitutes named placeholders", () => {
    render(
      <LocaleProvider>
        <Interpolated msgKey="pipeline.stale" params={{ days: 4 }} />
      </LocaleProvider>,
    );
    expect(screen.getByText("Stale 4d")).toBeInTheDocument();
  });

  it("leaves an unmatched placeholder untouched", () => {
    render(
      <LocaleProvider>
        <Interpolated msgKey="pipeline.stale" params={{ other: 1 }} />
      </LocaleProvider>,
    );
    expect(screen.getByText("Stale {days}d")).toBeInTheDocument();
  });

  it("returns the template unchanged when no params are given", () => {
    render(
      <LocaleProvider>
        <Interpolated
          msgKey="panel.nothingSelected"
          params={undefined as unknown as Record<string, string>}
        />
      </LocaleProvider>,
    );
    expect(screen.getByText("Nothing selected")).toBeInTheDocument();
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
