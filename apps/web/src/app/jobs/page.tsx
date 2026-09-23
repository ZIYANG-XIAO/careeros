"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { createJob, listJobs } from "@/lib/api";
import type { Job } from "@/lib/types";

export default function JobsPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Missing authentication token");
        const result = await listJobs(token);
        if (!cancelled) setJobs(result);
      } catch {
        if (!cancelled)
          setError("We could not load your jobs. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
  if (!isSignedIn) {
    return <p className="text-sm text-slate-600">Sign in to manage jobs.</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
          Job Intelligence
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          Understand a job through your actual evidence
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Paste a job description. CareerOS preserves the original text,
          extracts grounded requirements, and compares them with your Career
          Brain and a resume you choose.
        </p>

        <form
          className="mt-7 grid gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit}
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
            <Textarea
              label="Job description"
              name="description"
              required
              minLength={20}
              rows={12}
              placeholder="Paste the complete job description"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={creating}>
              {creating ? "Parsing requirements…" : "Create job"}
            </Button>
          </div>
        </form>
        {error && (
          <div
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        )}
      </section>

      <section aria-labelledby="saved-jobs-heading">
        <h2
          id="saved-jobs-heading"
          className="mb-3 text-lg font-semibold text-slate-950"
        >
          Saved jobs
        </h2>
        {jobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
            No jobs yet. Add a real role above to begin Job Intelligence.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {job.company}
                </p>
                <h3 className="mt-1 font-semibold text-slate-950">
                  {job.title}
                </h3>
                <p className="mt-3 text-sm text-slate-500">
                  {job.latest_snapshot.requirements.length} grounded
                  requirements
                  {job.location ? ` · ${job.location}` : ""}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
