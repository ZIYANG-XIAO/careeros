import {
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
  useState,
} from "react";

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

const pillSelectClass =
  "h-10 max-w-[180px] rounded-full border border-border bg-surface px-3 text-sm font-semibold text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-focus-ring";

export const selectClass =
  "block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-focus-ring";

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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  function selectMarket(market: Filters["market"]) {
    setFilters((current) => ({
      ...current,
      market,
      countryCode:
        market === "NORTH_AMERICA" && current.countryCode === "CN"
          ? ""
          : market === "CHINA" &&
              (current.countryCode === "US" || current.countryCode === "CA")
            ? ""
            : current.countryCode,
    }));
  }

  return (
    <section
      className="sticky top-16 z-20 rounded-2xl border border-border bg-ground/95 p-3 shadow-sm backdrop-blur"
      aria-label={t("jobs.searchArea")}
    >
      <form className="flex flex-wrap items-center gap-2" onSubmit={onFilter}>
        <label className="relative min-w-[240px] flex-1">
          <span className="sr-only">{t("jobs.search")}</span>
          <svg
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M20 20l-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("jobs.searchPlaceholder")}
            maxLength={200}
            className="h-11 w-full rounded-full border border-border bg-surface pr-4 pl-10 text-sm text-ink shadow-sm outline-none placeholder:text-ink-3 focus:border-accent focus:ring-2 focus:ring-accent-focus-ring"
          />
        </label>

        <label className="relative hidden min-w-[170px] flex-[0.55] lg:block">
          <span className="sr-only">{t("jobs.location")}</span>
          <svg
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 21s6-5.2 6-11a6 6 0 10-12 0c0 5.8 6 11 6 11z"
            />
            <circle cx="12" cy="10" r="2" />
          </svg>
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder={t("jobs.locationPlaceholder")}
            maxLength={200}
            className="h-11 w-full rounded-full border border-border bg-surface pr-4 pl-10 text-sm text-ink shadow-sm outline-none placeholder:text-ink-3 focus:border-accent focus:ring-2 focus:ring-accent-focus-ring"
          />
        </label>

        <button
          type="button"
          onClick={() => setMobileFiltersOpen((current) => !current)}
          aria-expanded={mobileFiltersOpen}
          aria-controls="discover-filter-pills"
          className="flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm font-semibold text-ink md:hidden"
        >
          <FilterIcon />
          {t("jobs.filters")}
        </button>

        <div
          id="discover-filter-pills"
          className={`${mobileFiltersOpen ? "flex" : "hidden"} w-full flex-wrap items-center gap-2 md:flex md:w-auto`}
        >
          <FilterSelect
            label={t("jobs.market")}
            value={filters.market}
            onChange={(value) => selectMarket(value as Filters["market"])}
          >
            <option value="">{t("jobs.allMarkets")}</option>
            <option value="NORTH_AMERICA">{t("jobs.northAmerica")}</option>
            <option value="CHINA">{t("jobs.china")}</option>
          </FilterSelect>
          <FilterSelect
            label={t("jobs.country")}
            value={filters.countryCode}
            onChange={(value) => {
              const countryCode = value as Filters["countryCode"];
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
          </FilterSelect>
          <FilterSelect
            label={t("jobs.workplace")}
            value={filters.workplaceType}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                workplaceType: value as Filters["workplaceType"],
              }))
            }
          >
            <option value="">{t("jobs.allWorkplaces")}</option>
            <option value="REMOTE">{t("jobs.remote")}</option>
            <option value="HYBRID">{t("jobs.hybrid")}</option>
            <option value="ONSITE">{t("jobs.onsite")}</option>
          </FilterSelect>
          <FilterSelect
            label={t("jobs.employment")}
            value={filters.employmentType}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                employmentType: value as Filters["employmentType"],
              }))
            }
          >
            <option value="">{t("jobs.allEmployment")}</option>
            <option value="FULL_TIME">{t("jobs.fullTime")}</option>
            <option value="PART_TIME">{t("jobs.partTime")}</option>
            <option value="CONTRACT">{t("jobs.contract")}</option>
            <option value="INTERNSHIP">{t("jobs.internship")}</option>
          </FilterSelect>
          <FilterSelect
            label={t("jobs.sort")}
            value={filters.sort}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                sort: value as Filters["sort"],
              }))
            }
          >
            <option value="recent">{t("jobs.recent")}</option>
            <option value="title">{t("jobs.titleSort")}</option>
          </FilterSelect>
          {hasFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="h-10 rounded-full px-3 text-sm font-semibold text-accent hover:bg-accent-tint"
            >
              {t("jobs.clearFilters")}
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={isRefreshing}
          className="h-10 rounded-full bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {isRefreshing ? t("jobs.searching") : t("jobs.searchAction")}
        </button>
      </form>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        className={pillSelectClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function FilterIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" d="M4 7h16M7 12h10m-7 5h4" />
    </svg>
  );
}
