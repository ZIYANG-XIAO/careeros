"use client";

import { useAuth } from "@clerk/nextjs";
import { type FormEvent, useCallback, useState } from "react";

import { createJob, listJobs, saveJob, unsaveJob } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useDataFetch } from "@/lib/use-data-fetch";
import type {
  Job,
  JobCountry,
  JobEmploymentType,
  JobMarket,
  JobWorkplaceType,
} from "@/lib/types";

import type { Filters } from "./job-filters";

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

export function useJobs(onCreated?: (job: Job) => void) {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { t } = useI18n();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Missing authentication token");
    return listJobs(token, {
      search: filters.search,
      location: filters.location,
      savedOnly: filters.view === "saved",
      market: filters.market || undefined,
      countryCode: filters.countryCode || undefined,
      workplaceType: filters.workplaceType || undefined,
      employmentType: filters.employmentType || undefined,
      sort: filters.sort,
    });
  }, [filters, getToken]);

  const {
    data: jobs,
    setData: setJobs,
    isInitialLoading,
    isRefreshing,
    loadError,
    refreshError,
    retry,
  } = useDataFetch({
    enabled: isLoaded && isSignedIn,
    resetKey: userId ?? undefined,
    initialData: [] as Job[],
    fetch: fetchJobs,
    deps: [filters, getToken, isLoaded, isSignedIn],
  });

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters((current) => ({ ...current, search, location }));
  }

  function clearFilters() {
    setSearch("");
    setLocation("");
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
      setActionError(null);
    } catch {
      setActionError(t("jobs.saveError"));
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
    setActionError(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
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
      setJobs((current) => [job, ...current]);
      setCreating(false);
      formElement.reset();
      onCreated?.(job);
    } catch {
      setActionError(t("jobs.createError"));
      setCreating(false);
    }
  }

  const hasFilters = Boolean(
    filters.search ||
    filters.location ||
    filters.market ||
    filters.countryCode ||
    filters.workplaceType ||
    filters.employmentType ||
    filters.sort !== "recent",
  );

  return {
    isLoaded,
    isSignedIn,
    filters,
    setFilters,
    search,
    setSearch,
    location,
    setLocation,
    creating,
    savingIds,
    actionError,
    jobs,
    isInitialLoading,
    isRefreshing,
    loadError,
    refreshError,
    retry,
    handleFilter,
    clearFilters,
    toggleSave,
    handleCreate,
    hasFilters,
  };
}
