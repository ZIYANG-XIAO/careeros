import { describe, expect, it } from "vitest";

import { formatSalary } from "./salary";

describe("formatSalary", () => {
  it("shows exact figures with thousands separators, never rounded to K", () => {
    expect(
      formatSalary(
        {
          minimum: 59600,
          maximum: 100000,
          currency: "USD",
          period: "YEAR",
          quote: "",
        },
        "en",
      ),
    ).toBe("$59,600 - $100,000 USD / year");
    expect(
      formatSalary(
        {
          minimum: 129022,
          maximum: 174283,
          currency: "USD",
          period: "YEAR",
          quote: "",
        },
        "en",
      ),
    ).toBe("$129,022 - $174,283 USD / year");
  });

  it("formats hourly ranges and a single exact amount", () => {
    expect(
      formatSalary(
        {
          minimum: 20.7,
          maximum: 20.7,
          currency: "USD",
          period: "HOUR",
          quote: "",
        },
        "zh-CN",
      ),
    ).toBe("$20.70 USD / 小时");
  });

  it("keeps the currency code for CAD", () => {
    expect(
      formatSalary(
        {
          minimum: 108000,
          maximum: 135000,
          currency: "CAD",
          period: "YEAR",
          quote: "",
        },
        "en",
      ),
    ).toBe("$108,000 - $135,000 CAD / year");
  });
});
