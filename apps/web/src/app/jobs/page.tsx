"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { createJob, listJobs, saveJob, unsaveJob } from "@/lib/api";
import { safeExternalUrl } from "@/lib/external-url";
import { jobSourceSummary } from "@/lib/job-source";
import { useI18n } from "@/lib/i18n";
import type {
  Job,
  JobCountry,
  JobEmploymentType,
  JobMarket,
  JobWorkplaceType,
} from "@/lib/types";

type View = "all" | "saved";
type Filters = {
  search: string;
  location: string;
  view: View;
  market: "" | Exclude<JobMarket, "UNKNOWN">;
  countryCode: "" | Exclude<JobCountry, "UNKNOWN">;
  workplaceType: "" | Exclude<JobWorkplaceType, "UNKNOWN">;
  employmentType: "" | Exclude<JobEmploymentType, "UNKNOWN">;
  sort: "recent" | "title";
};

const initialFilters: Filters = {
  search: "",
  location: "",
  view: "all",
  market: "",
  countryCode: "",
  workplaceType: "",
  employmentType: "",
  sort: "recent",
};

const selectClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

function JobCard({
  job,
  onToggleSave,
  saving,
}: {
  job: Job;
  onToggleSave: (job: Job) => void;
  saving: boolean;
}) {
  const { locale, t } = useI18n();
  const applicationUrl = safeExternalUrl(job.application_url);
  const excerpt = job.latest_snapshot.raw_description
    .replaceAll(/\s+/g, " ")
    .trim();

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
            {job.company}
          </p>
          <Link
            href={`/jobs/${job.id}`}
            className="mt-1 block text-lg font-semibold leading-6 text-slate-950 outline-none group-hover:text-blue-800 focus-visible:underline"
          >
            {job.title}
          </Link>
        </div>
        <button
          type="button"
          onClick={() => onToggleSave(job)}
          disabled={saving}
          aria-pressed={job.is_saved}
          aria-label={`${job.is_saved ? t("jobs.unsave") : t("jobs.save")} ${job.title}`}
          className={`shrink-0 rounded-full p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50 ${
            job.is_saved
              ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
              : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          }`}
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill={job.is_saved ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 4.75A1.75 1.75 0 017.75 3h8.5A1.75 1.75 0 0118 4.75V21l-6-3.75L6 21V4.75z"
            />
          </svg>
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {job.location && <span>{job.location}</span>}
        {job.location && <span aria-hidden="true">·</span>}
        <span>
          {job.latest_snapshot.requirements.length} {t("jobs.requirements")}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {job.market !== "UNKNOWN" && (
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-800">
            {job.market === "NORTH_AMERICA"
              ? t("jobs.northAmerica")
              : t("jobs.china")}
          </span>
        )}
        {job.workplace_type !== "UNKNOWN" && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            {t(
              job.workplace_type === "REMOTE"
                ? "jobs.remote"
                : job.workplace_type === "HYBRID"
                  ? "jobs.hybrid"
                  : "jobs.onsite",
            )}
          </span>
        )}
        {job.employment_type !== "UNKNOWN" && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            {t(
              job.employment_type === "FULL_TIME"
                ? "jobs.fullTime"
                : job.employment_type === "PART_TIME"
                  ? "jobs.partTime"
                  : job.employment_type === "CONTRACT"
                    ? "jobs.contract"
                    : "jobs.internship",
            )}
          </span>
        )}
      </div>
      <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">
        {excerpt}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        {applicationUrl ? (
          <a
            href={applicationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            {t("jobs.apply")}
            <svg
              className="ml-1.5 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14 5h5v5m0-5L10 14m8 0v4a1 1 0 01-1 1H6a1 1 0 01-1-1V7a1 1 0 011-1h4"
              />
            </svg>
          </a>
        ) : (
          <span className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-500">
            {t("jobs.noApply")}
          </span>
        )}
        <Link
          href={`/jobs/${job.id}`}
          className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          {t("jobs.viewDetails")}
        </Link>
      </div>
      <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
        {jobSourceSummary(job, locale)}
      </p>
    </article>
  );
}

export default function JobsPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const { locale, t } = useI18n();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Missing authentication token");
        const result = await listJobs(token, {
          search: filters.search,
          location: filters.location,
          savedOnly: filters.view === "saved",
          market: filters.market || undefined,
          countryCode: filters.countryCode || undefined,
          workplaceType: filters.workplaceType || undefined,
          employmentType: filters.employmentType || undefined,
          sort: filters.sort,
        });
        if (!cancelled) {
          setJobs(result);
          setError(null);
        }
      } catch {
        if (!cancelled) setError(t("jobs.loadError"));
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters, getToken, isLoaded, isSignedIn, t]);

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRefreshing(true);
    setFilters((current) => ({ ...current, search, location }));
  }

  function clearFilters() {
    setSearch("");
    setLocation("");
    setRefreshing(true);
    setFilters({ ...initialFilters, view: filters.view });
  }

  async function toggleSave(job: Job) {
    setSavingIds((current) => new Set(current).add(job.id));
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      if (job.is_saved) {
        await unsaveJob(token, job.id);
        if (filters.view === "saved") {
          setJobs((current) => current.filter((item) => item.id !== job.id));
        } else {
          setJobs((current) =>
            current.map((item) =>
              item.id === job.id ? { ...item, is_saved: false } : item,
            ),
          );
        }
      } else {
        const saved = await saveJob(token, job.id);
        setJobs((current) =>
          current.map((item) => (item.id === job.id ? saved : item)),
        );
      }
      setError(null);
    } catch {
      setError(t("jobs.saveError"));
    } finally {
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(job.id);
        return next;
      });
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const countryCode = String(
      form.get("country_code") ?? "UNKNOWN",
    ) as JobCountry;
    const selectedMarket = String(form.get("market") ?? "UNKNOWN") as JobMarket;
    const market =
      countryCode === "CN"
        ? "CHINA"
        : countryCode === "US" || countryCode === "CA"
          ? "NORTH_AMERICA"
          : selectedMarket;
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      const job = await createJob(token, {
        company: String(form.get("company") ?? ""),
        title: String(form.get("title") ?? ""),
        location: String(form.get("location") ?? "") || null,
        source_url: String(form.get("source_url") ?? "") || null,
        application_url: String(form.get("application_url") ?? "") || null,
        description: String(form.get("description") ?? ""),
        market,
        country_code: countryCode,
        workplace_type: String(
          form.get("workplace_type") ?? "UNKNOWN",
        ) as JobWorkplaceType,
        employment_type: String(
          form.get("employment_type") ?? "UNKNOWN",
        ) as JobEmploymentType,
      });
      router.push(`/jobs/${job.id}`);
    } catch {
      setError(t("jobs.createError"));
      setCreating(false);
    }
  }

  if (!isLoaded || (loading && isSignedIn)) return <Spinner />;
  if (!isSignedIn)
    return <p className="text-sm text-slate-600">{t("jobs.signIn")}</p>;

  const hasFilters = Boolean(
    filters.search ||
    filters.location ||
    filters.market ||
    filters.countryCode ||
    filters.workplaceType ||
    filters.employmentType ||
    filters.sort !== "recent",
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            {t("jobs.discover")}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            {t("jobs.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {t("jobs.intro")}
          </p>
        </div>
        <a
          href="#add-job"
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          {t("jobs.addManual")}
        </a>
      </header>

      <section
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        aria-label={t("jobs.searchArea")}
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
                setRefreshing(true);
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
          onSubmit={handleFilter}
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
          <Button type="submit" className="h-10" disabled={refreshing}>
            {refreshing ? t("jobs.searching") : t("jobs.searchAction")}
          </Button>
        </form>
        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span className="block">{t("jobs.country")}</span>
            <select
              className={selectClass}
              value={filters.countryCode}
              onChange={(event) => {
                const countryCode = event.target
                  .value as Filters["countryCode"];
                setRefreshing(true);
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
                setRefreshing(true);
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
                setRefreshing(true);
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
          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span className="block">{t("jobs.sort")}</span>
            <select
              className={selectClass}
              value={filters.sort}
              onChange={(event) => {
                setRefreshing(true);
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
            aria-label="Job views"
          >
            {(["all", "saved"] as const).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => {
                  setRefreshing(true);
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
              onClick={clearFilters}
              className="text-sm font-medium text-blue-700 hover:text-blue-900"
            >
              {t("jobs.clearFilters")}
            </button>
          )}
        </div>
      </section>

      {error && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          {error}
        </div>
      )}

      <section aria-labelledby="job-results-heading" aria-busy={refreshing}>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2
            id="job-results-heading"
            className="text-lg font-semibold text-slate-950"
          >
            {filters.view === "saved"
              ? t("jobs.savedJobs")
              : t("jobs.yourJobs")}
          </h2>
          <p className="text-sm text-slate-500">
            {locale === "zh-CN"
              ? `${jobs.length} ${t("jobs.jobs")}`
              : `${jobs.length} ${jobs.length === 1 ? t("jobs.job") : t("jobs.jobs")}`}
          </p>
        </div>
        {jobs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.7}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 6h6m-7 4h8m-9 4h10M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z"
                />
              </svg>
            </div>
            <h3 className="mt-4 font-semibold text-slate-950">
              {filters.view === "saved"
                ? t("jobs.noSaved")
                : hasFilters
                  ? t("jobs.noMatch")
                  : t("jobs.ready")}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {filters.view === "saved"
                ? t("jobs.noSavedHint")
                : hasFilters
                  ? t("jobs.noMatchHint")
                  : t("jobs.readyHint")}
            </p>
            {hasFilters && (
              <Button
                variant="secondary"
                className="mt-5"
                onClick={clearFilters}
              >
                {t("jobs.clearFilters")}
              </Button>
            )}
          </div>
        ) : (
          <div
            className={`grid gap-4 md:grid-cols-2 xl:grid-cols-3 ${refreshing ? "opacity-60" : ""}`}
          >
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onToggleSave={(item) => void toggleSave(item)}
                saving={savingIds.has(job.id)}
              />
            ))}
          </div>
        )}
      </section>

      <details
        id="add-job"
        className="rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-800 marker:hidden sm:px-6">
          {t("jobs.addManual")}
          <span className="ml-2 text-xs font-normal text-slate-500">
            {t("jobs.addManualHint")}
          </span>
        </summary>
        <form
          className="grid gap-4 border-t border-slate-100 p-5 sm:grid-cols-2 sm:p-6"
          onSubmit={handleCreate}
        >
          <Input
            label={t("jobs.company")}
            name="company"
            required
            maxLength={500}
          />
          <Input
            label={t("jobs.jobTitle")}
            name="title"
            required
            maxLength={500}
          />
          <Input
            label={t("jobs.optionalLocation")}
            name="location"
            maxLength={500}
          />
          <Input
            label={t("jobs.sourceUrl")}
            name="source_url"
            type="url"
            placeholder="https://…"
          />
          <div className="sm:col-span-2">
            <Input
              label={t("jobs.applicationUrl")}
              name="application_url"
              type="url"
              placeholder="https://…"
            />
          </div>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span className="block">{t("jobs.market")}</span>
            <select
              className={selectClass}
              name="market"
              defaultValue="UNKNOWN"
            >
              <option value="UNKNOWN">{t("jobs.unknown")}</option>
              <option value="NORTH_AMERICA">{t("jobs.northAmerica")}</option>
              <option value="CHINA">{t("jobs.china")}</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span className="block">{t("jobs.country")}</span>
            <select
              className={selectClass}
              name="country_code"
              defaultValue="UNKNOWN"
            >
              <option value="UNKNOWN">{t("jobs.unknown")}</option>
              <option value="US">{t("jobs.us")}</option>
              <option value="CA">{t("jobs.ca")}</option>
              <option value="CN">{t("jobs.cn")}</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span className="block">{t("jobs.workplace")}</span>
            <select
              className={selectClass}
              name="workplace_type"
              defaultValue="UNKNOWN"
            >
              <option value="UNKNOWN">{t("jobs.unknown")}</option>
              <option value="REMOTE">{t("jobs.remote")}</option>
              <option value="HYBRID">{t("jobs.hybrid")}</option>
              <option value="ONSITE">{t("jobs.onsite")}</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span className="block">{t("jobs.employment")}</span>
            <select
              className={selectClass}
              name="employment_type"
              defaultValue="UNKNOWN"
            >
              <option value="UNKNOWN">{t("jobs.unknown")}</option>
              <option value="FULL_TIME">{t("jobs.fullTime")}</option>
              <option value="PART_TIME">{t("jobs.partTime")}</option>
              <option value="CONTRACT">{t("jobs.contract")}</option>
              <option value="INTERNSHIP">{t("jobs.internship")}</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            <Textarea
              label={t("jobs.description")}
              name="description"
              required
              minLength={20}
              rows={10}
              placeholder={t("jobs.descriptionPlaceholder")}
            />
          </div>
          <div className="sm:col-span-2 flex items-center justify-between gap-4">
            <p className="text-xs text-slate-500">{t("jobs.manualPrivacy")}</p>
            <Button type="submit" disabled={creating}>
              {creating ? t("jobs.parsing") : t("jobs.addJob")}
            </Button>
          </div>
        </form>
      </details>
    </div>
  );
}
