import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MessageKey } from "@/lib/i18n";
import type {
  JobCountry,
  JobEmploymentType,
  JobMarket,
  JobWorkplaceType,
} from "@/lib/types";

export type View = "all" | "saved" | "mine";
export type Filters = {
  search: string;
  location: string;
  view: View;
  market: "" | Exclude<JobMarket, "UNKNOWN">;
  countryCode: "" | Exclude<JobCountry, "UNKNOWN">;
  workplaceType: "" | Exclude<JobWorkplaceType, "UNKNOWN">;
  employmentType: "" | Exclude<JobEmploymentType, "UNKNOWN">;
  sort: "recent" | "title";
};

export const selectClass =
  "block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-focus-ring";

const COLLAPSE_STORAGE_KEY = "careeros.discover.filtersExpanded";

function summarizeFilters(
  filters: Filters,
  t: (key: MessageKey) => string,
): string[] {
  const summary: string[] = [];

  if (filters.countryCode) {
    summary.push(
      t(
        (
          {
            US: "jobs.us",
            CA: "jobs.ca",
            CN: "jobs.cn",
          } as const
        )[filters.countryCode],
      ),
    );
  } else if (filters.market) {
    summary.push(
      t(filters.market === "CHINA" ? "jobs.china" : "jobs.northAmerica"),
    );
  }

  if (filters.workplaceType) {
    summary.push(
      t(
        (
          {
            REMOTE: "jobs.remote",
            HYBRID: "jobs.hybrid",
            ONSITE: "jobs.onsite",
          } as const
        )[filters.workplaceType],
      ),
    );
  }

  if (filters.employmentType) {
    summary.push(
      t(
        (
          {
            FULL_TIME: "jobs.fullTime",
            PART_TIME: "jobs.partTime",
            CONTRACT: "jobs.contract",
            INTERNSHIP: "jobs.internship",
          } as const
        )[filters.employmentType],
      ),
    );
  }

  if (filters.search) summary.push(`"${filters.search}"`);
  if (filters.location) summary.push(filters.location);

  return summary;
}

export function JobFilters({
  filters,
  setFilters,
  search,
  setSearch,
  location,
  setLocation,
  isRefreshing,
  hasFilters,
  onFilter,
  onClearFilters,
  t,
}: {
  filters: Filters;
  setFilters: Dispatch<SetStateAction<Filters>>;
  search: string;
  setSearch: (value: string) => void;
  location: string;
  setLocation: (value: string) => void;
  isRefreshing: boolean;
  hasFilters: boolean;
  onFilter: (event: FormEvent<HTMLFormElement>) => void;
  onClearFilters: () => void;
  t: (key: MessageKey) => string;
}) {
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) !== "false";
  });

  function toggleExpanded() {
    setExpanded((current) => {
      const next = !current;
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
      return next;
    });
  }

  const summary = expanded ? [] : summarizeFilters(filters, t);

  return (
    <section
      className="rounded-2xl border border-border bg-surface shadow-sm"
      aria-label={t("jobs.searchArea")}
    >
      <div className="flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-controls="job-filters-body"
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="text-sm font-semibold text-ink">
            {t("jobs.filters")}
          </span>
          {summary.length > 0 && (
            <span className="flex min-w-0 flex-wrap gap-1">
              {summary.map((label) => (
                <span
                  key={label}
                  className="truncate rounded-full bg-accent-tint px-2 py-0.5 text-xs font-medium text-accent"
                >
                  {label}
                </span>
              ))}
            </span>
          )}
        </button>
        <span className="flex shrink-0 items-center gap-3">
          {!expanded && hasFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="rounded text-xs font-medium text-accent hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t("jobs.clearFilters")}
            </button>
          )}
          <button
            type="button"
            onClick={toggleExpanded}
            aria-expanded={expanded}
            aria-controls="job-filters-body"
            aria-label={t("jobs.filters")}
            className="rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <svg
              className={`h-4 w-4 text-ink-3 transition-transform ${expanded ? "rotate-180" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 9l6 6 6-6"
              />
            </svg>
          </button>
        </span>
      </div>

      {expanded && (
        <div
          id="job-filters-body"
          className="border-t border-border p-4 sm:p-5"
        >
          <div
            className="mb-4 flex flex-wrap gap-2"
            aria-label={t("jobs.market")}
          >
            {(
              [
                ["", "jobs.allMarkets"],
                ["NORTH_AMERICA", "jobs.northAmerica"],
                ["CHINA", "jobs.china"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value || "all"}
                type="button"
                onClick={() => {
                  setFilters((current) => ({
                    ...current,
                    market: value,
                    countryCode:
                      value === "NORTH_AMERICA" && current.countryCode === "CN"
                        ? ""
                        : value === "CHINA" &&
                            (current.countryCode === "US" ||
                              current.countryCode === "CA")
                          ? ""
                          : current.countryCode,
                  }));
                }}
                aria-pressed={filters.market === value}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  filters.market === value
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-surface text-ink-2 hover:border-border"
                }`}
              >
                {t(label)}
              </button>
            ))}
          </div>
          <form
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_0.8fr_auto] xl:items-end"
            onSubmit={onFilter}
          >
            <Input
              label={t("jobs.search")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("jobs.searchPlaceholder")}
              maxLength={200}
            />
            <Input
              label={t("jobs.location")}
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder={t("jobs.locationPlaceholder")}
              maxLength={200}
            />
            <Button type="submit" className="h-10" disabled={isRefreshing}>
              {isRefreshing ? t("jobs.searching") : t("jobs.searchAction")}
            </Button>
          </form>
          <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1 text-sm font-medium text-ink-2">
              <span className="block">{t("jobs.country")}</span>
              <select
                className={selectClass}
                value={filters.countryCode}
                onChange={(event) => {
                  const countryCode = event.target
                    .value as Filters["countryCode"];
                  setFilters((current) => ({
                    ...current,
                    countryCode,
                    market:
                      countryCode === "CN"
                        ? "CHINA"
                        : countryCode === "US" || countryCode === "CA"
                          ? "NORTH_AMERICA"
                          : current.market,
                  }));
                }}
              >
                <option value="">{t("jobs.allCountries")}</option>
                {filters.market !== "CHINA" && (
                  <option value="US">{t("jobs.us")}</option>
                )}
                {filters.market !== "CHINA" && (
                  <option value="CA">{t("jobs.ca")}</option>
                )}
                {filters.market !== "NORTH_AMERICA" && (
                  <option value="CN">{t("jobs.cn")}</option>
                )}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-ink-2">
              <span className="block">{t("jobs.workplace")}</span>
              <select
                className={selectClass}
                value={filters.workplaceType}
                onChange={(event) => {
                  setFilters((current) => ({
                    ...current,
                    workplaceType: event.target
                      .value as Filters["workplaceType"],
                  }));
                }}
              >
                <option value="">{t("jobs.allWorkplaces")}</option>
                <option value="REMOTE">{t("jobs.remote")}</option>
                <option value="HYBRID">{t("jobs.hybrid")}</option>
                <option value="ONSITE">{t("jobs.onsite")}</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-ink-2">
              <span className="block">{t("jobs.employment")}</span>
              <select
                className={selectClass}
                value={filters.employmentType}
                onChange={(event) => {
                  setFilters((current) => ({
                    ...current,
                    employmentType: event.target
                      .value as Filters["employmentType"],
                  }));
                }}
              >
                <option value="">{t("jobs.allEmployment")}</option>
                <option value="FULL_TIME">{t("jobs.fullTime")}</option>
                <option value="PART_TIME">{t("jobs.partTime")}</option>
                <option value="CONTRACT">{t("jobs.contract")}</option>
                <option value="INTERNSHIP">{t("jobs.internship")}</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-ink-2">
              <span className="block">{t("jobs.sort")}</span>
              <select
                className={selectClass}
                value={filters.sort}
                onChange={(event) => {
                  setFilters((current) => ({
                    ...current,
                    sort: event.target.value as Filters["sort"],
                  }));
                }}
              >
                <option value="recent">{t("jobs.recent")}</option>
                <option value="title">{t("jobs.titleSort")}</option>
              </select>
            </label>
          </div>
          {hasFilters && (
            <div className="mt-4 flex justify-end border-t border-border pt-4">
              <button
                type="button"
                onClick={onClearFilters}
                className="text-sm font-medium text-accent hover:text-accent-hover"
              >
                {t("jobs.clearFilters")}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
