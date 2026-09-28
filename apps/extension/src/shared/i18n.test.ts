import { afterEach, describe, expect, it } from "vitest";

import { detectionCopy } from "../popup/detection-copy";
import { fillButtonLabel, setExtensionLocale, t, ZH_CN } from "./i18n";

afterEach(() => setExtensionLocale("en"));

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

describe("extension i18n", () => {
  it("interpolates English by default", () => {
    expect(fillButtonLabel(false, 1)).toBe("Fill 1 approved field");
    expect(t("Attach resume: {label}", { label: "Main" })).toBe(
      "Attach resume: Main",
    );
  });

  it("translates to Simplified Chinese and falls back to English", () => {
    setExtensionLocale("zh-CN");
    expect(fillButtonLabel(true, 3)).toBe("保存上下文并填写 3 个已确认字段");
    expect(t("An untranslated sentence.")).toBe("An untranslated sentence.");
    expect(
      detectionCopy({
        status: "NOT_APPLICATION_PAGE",
        adapter: null,
        reasons: [],
        forms: [],
      }).title,
    ).toBe("未检测到申请表");
  });

  it("keeps every translation's placeholders identical to the English", () => {
    for (const [english, chinese] of Object.entries(ZH_CN)) {
      expect(placeholders(chinese), english).toEqual(placeholders(english));
    }
  });
});
