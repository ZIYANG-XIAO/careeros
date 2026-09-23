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
import type { Job } from "@/lib/types";

type View = "all" | "saved";
type Filters = { search: string; location: string; view: View };

const initialFilters: Filters = { search: "", location: "", view: "all" };

function JobCard({
  job,
  onToggleSave,
  saving,
}: {
  job: Job;
  onToggleSave: (job: Job) => void;
  saving: boolean;
}) {
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
          aria-label={
            job.is_saved ? `Unsave ${job.title}` : `Save ${job.title}`
          }
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
          {job.latest_snapshot.requirements.length} structured requirements
        </span>
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
            Apply
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
            Application link unavailable
          </span>
        )}
        <Link
          href={`/jobs/${job.id}`}
          className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          View details
        </Link>
      </div>
      <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
        {jobSourceSummary(job)}
      </p>
    </article>
  );
}

export default function JobsPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const router = useRouter();
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
        });
        if (!cancelled) {
          setJobs(result);
          setError(null);
        }
      } catch {
        if (!cancelled)
          setError("We could not load your jobs. Please try again.");
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
  }, [filters, getToken, isLoaded, isSignedIn]);

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRefreshing(true);
    setFilters((current) => ({ ...current, search, location }));
  }

  function clearFilters() {
    setSearch("");
    setLocation("");
    setRefreshing(true);
    setFilters((current) => ({ ...current, search: "", location: "" }));
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
      setError("We could not update this saved job. Please try again.");
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
      });
      router.push(`/jobs/${job.id}`);
    } catch {
      setError(
        "We could not parse this job description. Check the details and try again.",
      );
      setCreating(false);
    }
  }

  if (!isLoaded || (loading && isSignedIn)) return <Spinner />;
  if (!isSignedIn)
    return <p className="text-sm text-slate-600">Sign in to explore jobs.</p>;

  const hasFilters = Boolean(filters.search || filters.location);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Discover
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Jobs
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Browse opportunities you have brought into CareerOS. Apply directly,
            save what matters, or choose deeper analysis when you want it.
          </p>
        </div>
        <a
          href="#add-job"
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Add a job manually
        </a>
      </header>

      <section
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        aria-label="Search jobs"
      >
        <form
          className="grid gap-3 lg:grid-cols-[1fr_0.55fr_auto] lg:items-end"
          onSubmit={handleFilter}
        >
          <Input
            label="Search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Job title or company"
            maxLength={200}
          />
          <Input
            label="Location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Remote, city, or region"
            maxLength={200}
          />
          <Button type="submit" className="h-10" disabled={refreshing}>
            {refreshing ? "Searching…" : "Search jobs"}
          </Button>
        </form>
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
                {view === "all" ? "All jobs" : "Saved jobs"}
              </button>
            ))}
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-medium text-blue-700 hover:text-blue-900"
            >
              Clear search and location
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
            {filters.view === "saved" ? "Saved jobs" : "Your jobs"}
          </h2>
          <p className="text-sm text-slate-500">
            {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
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
                ? "No saved jobs yet"
                : hasFilters
                  ? "No jobs match these filters"
                  : "Your Jobs workspace is ready"}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {filters.view === "saved"
                ? "Save an opportunity from the Jobs list or job detail to keep it here."
                : hasFilters
                  ? "Try a broader title, company, or location."
                  : "Add a job manually while production job sources are still being formed."}
            </p>
            {hasFilters && (
              <Button
                variant="secondary"
                className="mt-5"
                onClick={clearFilters}
              >
                Clear filters
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
          Add a job manually
          <span className="ml-2 text-xs font-normal text-slate-500">
            For jobs you already found elsewhere
          </span>
        </summary>
        <form
          className="grid gap-4 border-t border-slate-100 p-5 sm:grid-cols-2 sm:p-6"
          onSubmit={handleCreate}
        >
          <Input label="Company" name="company" required maxLength={500} />
          <Input label="Job title" name="title" required maxLength={500} />
          <Input label="Location (optional)" name="location" maxLength={500} />
          <Input
            label="Source URL (optional)"
            name="source_url"
            type="url"
            placeholder="https://…"
          />
          <div className="sm:col-span-2">
            <Input
              label="Application URL (optional)"
              name="application_url"
              type="url"
              placeholder="https://…"
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              label="Job description"
              name="description"
              required
              minLength={20}
              rows={10}
              placeholder="Paste the complete job description"
            />
          </div>
          <div className="sm:col-span-2 flex items-center justify-between gap-4">
            <p className="text-xs text-slate-500">
              Manual jobs are private to your account and are not presented as
              live listings.
            </p>
            <Button type="submit" disabled={creating}>
              {creating ? "Parsing job…" : "Add job"}
            </Button>
          </div>
        </form>
      </details>
    </div>
  );
}
