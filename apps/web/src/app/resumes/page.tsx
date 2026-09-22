"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { listResumes, uploadResume } from "@/lib/api";
import type { ResumeSummary } from "@/lib/types";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ResumesPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;

    async function load() {
      try {
        const token = await getToken();
        if (!token) throw new Error("Missing authentication token");
        const result = await listResumes(token);
        if (cancelled) return;
        setResumes(result);
        setError(null);
      } catch {
        if (!cancelled) {
          setError("Failed to load your resume library. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  async function reload() {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      setResumes(await listResumes(token));
      setError(null);
    } catch {
      setError("Failed to load your resume library. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      const result = await uploadResume(token, file);
      router.push(`/resumes/imports/${result.id}`);
    } catch {
      setError(
        "We could not extract this resume. Use a readable PDF or DOCX under 5 MB and try again.",
      );
      event.target.value = "";
    } finally {
      setUploading(false);
    }
  }

  if (!isLoaded || (loading && isSignedIn)) return <Spinner />;
  if (!isSignedIn) {
    return <p className="text-sm text-slate-600">Sign in to manage resumes.</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
          Resume Library
        </p>
        <div className="mt-2 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              Your resumes
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Upload a base resume, review every extracted fact, then choose
              what becomes part of your Career Brain.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2">
            {uploading ? "Extracting resume…" : "Upload resume"}
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              disabled={uploading}
              onChange={handleUpload}
              aria-label="Upload resume"
            />
          </label>
        </div>
        {uploading && (
          <p className="mt-4 text-sm text-blue-700" role="status">
            Securely uploading, extracting, and organizing your resume…
          </p>
        )}
        {error && (
          <div
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        )}
      </section>

      {resumes.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <h2 className="text-base font-semibold text-slate-900">
            No resumes yet
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Upload a PDF or DOCX to create your first grounded Career Brain
            draft.
          </p>
        </section>
      ) : (
        <section aria-labelledby="resume-list-heading">
          <h2 id="resume-list-heading" className="sr-only">
            Uploaded resumes
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {resumes.map((resume) => {
              const current = resume.versions[0];
              return (
                <Link
                  key={resume.id}
                  href={`/resumes/${resume.id}`}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-950">
                        {resume.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {resume.versions.length}{" "}
                        {resume.versions.length === 1 ? "version" : "versions"}
                      </p>
                    </div>
                    {resume.is_primary && (
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                        Base resume
                      </span>
                    )}
                  </div>
                  {current && (
                    <p className="mt-5 text-xs text-slate-500">
                      Version {current.version_number} · Uploaded{" "}
                      {formatDate(current.created_at)}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}
      {error && (
        <Button variant="secondary" onClick={() => void reload()}>
          Retry
        </Button>
      )}
    </div>
  );
}
