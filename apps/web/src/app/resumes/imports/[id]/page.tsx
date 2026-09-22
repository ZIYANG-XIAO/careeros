"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ResumeReview } from "@/components/resume-review";
import { Spinner } from "@/components/ui/spinner";
import { getResumeImport } from "@/lib/api";
import type { ResumeImport } from "@/lib/types";

export default function ResumeImportPage() {
  const { id } = useParams<{ id: string }>();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [resumeImport, setResumeImport] = useState<ResumeImport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Missing authentication token");
        const result = await getResumeImport(token, id);
        if (!cancelled) setResumeImport(result);
      } catch {
        if (!cancelled) setError("This resume import could not be loaded.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, id, isLoaded, isSignedIn]);

  if (!isLoaded || (isSignedIn && !resumeImport && !error)) return <Spinner />;
  if (!isSignedIn)
    return (
      <p className="text-sm text-slate-600">Sign in to review this import.</p>
    );
  if (error || !resumeImport) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <Link
          href="/resumes"
          className="text-sm font-medium text-blue-700 hover:text-blue-900"
        >
          ← Resume library
        </Link>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
          Review extraction
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          What CareerOS found in {resumeImport.resume_name}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Correct or remove anything that is not accurate. Resume content
          remains unconfirmed until you approve it.
        </p>
      </header>
      <ResumeReview initialImport={resumeImport} />
    </div>
  );
}
