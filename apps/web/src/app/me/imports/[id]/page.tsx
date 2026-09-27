"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ResumeReview } from "@/components/resume-review";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getContactInfo, getResumeImport } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { ContactInfo, ResumeImport } from "@/lib/types";

export default function ResumeImportPage() {
  const { id } = useParams<{ id: string }>();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { t } = useI18n();
  const [resumeImport, setResumeImport] = useState<ResumeImport | null>(null);
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const [prevFetchKey, setPrevFetchKey] = useState(0);

  if (fetchKey !== prevFetchKey) {
    setPrevFetchKey(fetchKey);
    setError(null);
    setResumeImport(null);
    setContactInfo(null);
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Missing authentication token");
        const [result, currentContactInfo] = await Promise.all([
          getResumeImport(token, id),
          getContactInfo(token),
        ]);
        if (!cancelled) {
          setResumeImport(result);
          setContactInfo(currentContactInfo);
        }
      } catch {
        if (!cancelled) setError(t("resumes.import.loadError"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, id, isLoaded, isSignedIn, t, fetchKey]);

  if (!isLoaded || (isSignedIn && (!resumeImport || !contactInfo) && !error))
    return <Spinner />;
  if (!isSignedIn)
    return (
      <p className="text-sm text-ink-2">{t("resumes.import.signInRequired")}</p>
    );
  if (error || !resumeImport || !contactInfo) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div
          className="rounded-xl border border-evidence-gap-border bg-evidence-gap-bg p-5 text-sm text-[#6F3627]"
          role="alert"
        >
          <p>{error ?? t("resumes.import.loadError")}</p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => setFetchKey((k) => k + 1)}
          >
            {t("errors.retry")}
          </Button>
        </div>
        <Link
          href="/me/resumes"
          className="inline-flex text-sm font-medium text-accent hover:text-accent-hover"
        >
          ← {t("resumes.import.backToLibrary")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <Link
          href="/me/resumes"
          className="text-sm font-medium text-accent hover:text-accent-hover"
        >
          {t("resumes.import.backToLibrary")}
        </Link>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          {t("resumes.import.eyebrow")}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {t("resumes.import.titlePrefix")}
          {resumeImport.resume_name}
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-2">
          {t("resumes.import.description")}
        </p>
      </header>
      <ResumeReview
        initialImport={resumeImport}
        currentContactInfo={contactInfo}
      />
    </div>
  );
}
