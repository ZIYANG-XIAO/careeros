"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

import { ContactInfoSection } from "@/components/contact-info-section";
import { EducationSection } from "@/components/education-section";
import { ExperienceSection } from "@/components/experience-section";
import { ProjectSection } from "@/components/project-section";
import { SkillSection } from "@/components/skill-section";
import { Spinner } from "@/components/ui/spinner";
import { getCareerBrain, getContactInfo } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { CareerBrain, ContactInfo } from "@/lib/types";

const EMPTY_CONTACT_INFO: ContactInfo = {
  first_name: null,
  last_name: null,
  preferred_name: null,
  phone: null,
  address_line_1: null,
  address_line_2: null,
  city: null,
  region: null,
  postal_code: null,
  country_code: null,
  linkedin_url: null,
  portfolio_url: null,
  confirmed_at: null,
};

export default function CareerProfilePage() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { user } = useUser();
  const { t } = useI18n();
  const retryLabel = t("errors.retry");
  const [brain, setBrain] = useState<CareerBrain | null>(null);
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const [prevUserId, setPrevUserId] = useState(userId);
  if (userId !== prevUserId) {
    setPrevUserId(userId);
    setBrain(null);
    setContactInfo(null);
    setError(null);
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;

    async function load() {
      try {
        const token = await getToken();
        if (cancelled) return;
        if (!token) {
          setError(t("career.authTokenError"));
          return;
        }
        const [brainData, contactData] = await Promise.all([
          getCareerBrain(token),
          getContactInfo(token),
        ]);
        if (cancelled) return;
        setBrain(brainData);
        setContactInfo(contactData);
        setError(null);
      } catch {
        if (!cancelled) {
          setError(t("contactInfo.loadError"));
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, getToken, fetchKey, t]);

  const refetch = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getCareerBrain(token);
      setBrain(data);
      setError(null);
    } catch {
      setError(t("contactInfo.loadError"));
    }
  }, [getToken, t]);

  const dataLoading =
    isLoaded &&
    isSignedIn &&
    (brain === null || contactInfo === null) &&
    error === null;

  if (!isLoaded) {
    return <Spinner />;
  }

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">
          {t("career.signInRequired.title")}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {t("career.signInRequired.description")}
        </p>
      </div>
    );
  }

  if (dataLoading) {
    return <Spinner />;
  }

  if (error || !brain || !contactInfo) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-medium text-red-800">
          {error || t("errors.unknown")}
        </p>
        <button
          onClick={() => {
            setError(null);
            setBrain(null);
            setContactInfo(null);
            setFetchKey((k) => k + 1);
          }}
          className="mt-3 text-sm font-medium text-red-700 underline hover:text-red-900"
        >
          {retryLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
          {t("career.eyebrow")}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          {t("career.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          {t("career.intro")}
        </p>
        {user?.primaryEmailAddress?.emailAddress && (
          <p className="mt-4 text-xs font-medium text-slate-400">
            {t("career.signedInAs")} {user.primaryEmailAddress.emailAddress}
          </p>
        )}
      </div>

      <ContactInfoSection
        contactInfo={contactInfo ?? EMPTY_CONTACT_INFO}
        onSaved={setContactInfo}
      />
      <EducationSection educations={brain.educations} onMutate={refetch} />
      <ExperienceSection experiences={brain.experiences} onMutate={refetch} />
      <ProjectSection projects={brain.projects} onMutate={refetch} />
      <SkillSection skills={brain.skills} onMutate={refetch} />
    </div>
  );
}
