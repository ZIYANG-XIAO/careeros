import { describe, expect, it } from "vitest";

import { daysSince, formatRelativeTime } from "./relative-time";

const now = new Date("2026-09-27T12:00:00Z");

describe("formatRelativeTime", () => {
  it("returns today under 24h", () => {
    expect(formatRelativeTime("2026-09-27T01:00:00Z", "en", now)).toBe("today");
    expect(formatRelativeTime("2026-09-27T01:00:00Z", "zh-CN", now)).toBe(
      "今天",
    );
  });

  it("formats days under a week", () => {
    expect(formatRelativeTime("2026-09-24T12:00:00Z", "en", now)).toBe("3d");
    expect(formatRelativeTime("2026-09-24T12:00:00Z", "zh-CN", now)).toBe(
      "3天",
    );
  });

  it("formats weeks under 60 days", () => {
    expect(formatRelativeTime("2026-09-13T12:00:00Z", "en", now)).toBe("2w");
  });

  it("formats months at 60+ days", () => {
    expect(formatRelativeTime("2026-06-27T12:00:00Z", "en", now)).toBe("3mo");
  });
});

describe("daysSince", () => {
  it("counts whole elapsed days", () => {
    expect(daysSince("2026-09-24T12:00:00Z", now)).toBe(3);
    expect(daysSince("2026-09-27T00:00:00Z", now)).toBe(0);
  });
});
