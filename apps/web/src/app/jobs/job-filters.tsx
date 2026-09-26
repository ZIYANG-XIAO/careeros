import { type Dispatch, type FormEvent, type SetStateAction } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MessageKey } from "@/lib/i18n";
import type {
  JobCountry,
  JobEmploymentType,
  JobMarket,
  JobWorkplaceType,
} from "@/lib/types";

export type View = "all" | "saved";
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
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

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
  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-label={t("jobs.searchArea")}
    >
      <div className="mb-4 flex flex-wrap gap-2" aria-label={t("jobs.market")}>
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
                ? "border-blue-700 bg-blue-700 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
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
      <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span className="block">{t("jobs.country")}</span>
          <select
            className={selectClass}
            value={filters.countryCode}
            onChange={(event) => {
              const countryCode = event.target.value as Filters["countryCode"];
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
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span className="block">{t("jobs.workplace")}</span>
          <select
            className={selectClass}
            value={filters.workplaceType}
            onChange={(event) => {
              setFilters((current) => ({
                ...current,
                workplaceType: event.target.value as Filters["workplaceType"],
              }));
            }}
          >
            <option value="">{t("jobs.allWorkplaces")}</option>
            <option value="REMOTE">{t("jobs.remote")}</option>
            <option value="HYBRID">{t("jobs.hybrid")}</option>
            <option value="ONSITE">{t("jobs.onsite")}</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span className="block">{t("jobs.employment")}</span>
          <select
            className={selectClass}
            value={filters.employmentType}
            onChange={(event) => {
              setFilters((current) => ({
                ...current,
                employmentType: event.target.value as Filters["employmentType"],
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
        <label className="space-y-1 text-sm font-medium text-slate-700">
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
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div
          className="inline-flex rounded-xl bg-slate-100 p-1"
          aria-label={t("jobs.filterViews")}
        >
          {(["all", "saved"] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => {
                setFilters((current) => ({ ...current, view }));
              }}
              aria-pressed={filters.view === view}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
                filters.view === view
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {view === "all" ? t("jobs.allJobs") : t("jobs.savedJobs")}
            </button>
          ))}
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            {t("jobs.clearFilters")}
          </button>
        )}
      </div>
    </section>
  );
}
