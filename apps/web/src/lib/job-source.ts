import type { Job } from "./types";
import type { Locale } from "./i18n";

type JobSourceFields = Pick<
  Job,
  "source_type" | "source_key" | "availability_status" | "freshness_status"
>;

export function jobSourceSummary(
  job: JobSourceFields,
  locale: Locale = "en",
): string {
  const chinese = locale === "zh-CN";
  if (job.source_type === "MANUAL_ENTRY") {
    return chinese
      ? "手动添加 · 非实时职位源"
      : "Added manually · not a live job feed";
  }

  const source =
    job.source_key === "demo"
      ? chinese
        ? "演示数据源"
        : "Demo source"
      : job.source_key;
  const availability =
    job.availability_status === "AVAILABLE"
      ? chinese
        ? "可申请"
        : "available"
      : job.availability_status === "UNAVAILABLE"
        ? chinese
          ? "不可申请"
          : "unavailable"
        : chinese
          ? "可用状态未知"
          : "availability unknown";
  const freshness =
    job.freshness_status === "CURRENT"
      ? chinese
        ? "当前有效"
        : "current"
      : job.freshness_status === "STALE"
        ? chinese
          ? "可能过期"
          : "stale"
        : chinese
          ? "时效未知"
          : "freshness unknown";
  return `${source} · ${availability} · ${freshness}`;
}
