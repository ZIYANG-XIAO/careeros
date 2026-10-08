import type { Locale } from "./i18n";
import type { SalaryRange } from "./types";

function money(amount: number): string {
  const decimals = Number.isInteger(amount) ? 0 : 2;
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * The exact range the posting states, e.g. "$59,600 - $100,000 USD / year"
 * or "$20.70 USD / hour". Numbers are shown in full (never rounded to "K")
 * since this is a quoted fact, not an estimate.
 */
export function formatSalary(range: SalaryRange, locale: Locale): string {
  const span =
    range.minimum === range.maximum
      ? money(range.minimum)
      : `${money(range.minimum)} - ${money(range.maximum)}`;
  const unit =
    range.period === "HOUR"
      ? locale === "zh-CN"
        ? "/ 小时"
        : "/ hour"
      : locale === "zh-CN"
        ? "/ 年"
        : "/ year";
  return `${span} ${range.currency} ${unit}`;
}
