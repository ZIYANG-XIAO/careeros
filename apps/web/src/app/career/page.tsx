"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

import { EducationSection } from "@/components/education-section";
import { ExperienceSection } from "@/components/experience-section";
import { ProjectSection } from "@/components/project-section";
import { SkillSection } from "@/components/skill-section";
import { Spinner } from "@/components/ui/spinner";
import { getCareerBrain } from "@/lib/api";
import type { CareerBrain } from "@/lib/types";

export default function CareerProfilePage() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { user } = useUser();
  const [brain, setBrain] = useState<CareerBrain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  // Track previous userId to detect identity changes during render.
  // This follows the React "storing information from previous renders" pattern.
  const [prevUserId, setPrevUserId] = useState(userId);
  if (userId !== prevUserId) {
    setPrevUserId(userId);
    setBrain(null);
    setError(null);
  }

  // Load career brain when auth is ready and user is signed in.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;

    async function load() {
      try {
        const token = await getToken();
        if (cancelled) return;
        if (!token) {
          setError(
            "Unable to obtain authentication token. Please sign in again.",
          );
          return;
        }
        const data = await getCareerBrain(token);
        if (cancelled) return;
        setBrain(data);
        setError(null);
      } catch {
        if (!cancelled) {
          setError("Failed to load career profile. Please try again.");
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, getToken, fetchKey]);

  const refetch = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getCareerBrain(token);
      setBrain(data);
      setError(null);
    } catch {
      setError("Failed to refresh career profile.");
    }
  }, [getToken]);

  // Derive loading: signed in but no data and no error yet.
  const dataLoading =
    isLoaded && isSignedIn && brain === null && error === null;

  // 1. Clerk still loading
  if (!isLoaded) {
    return <Spinner />;
  }

  // 2. Signed out
  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">
          Sign in required
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Please sign in to view your career profile.
        </p>
      </div>
    );
  }

  // 3. Loading career brain
  if (dataLoading) {
    return <Spinner />;
  }

  // 4. Error / no brain
  if (error || !brain) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-medium text-red-800">
          {error || "Something went wrong"}
        </p>
        <button
          onClick={() => {
            setError(null);
            setBrain(null);
            setFetchKey((k) => k + 1);
          }}
          className="mt-3 text-sm font-medium text-red-700 underline hover:text-red-900"
        >
          Retry
        </button>
      </div>
    );
  }

  // 5. Signed in with data
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
          Your Career Brain
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          Career Profile
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Keep the professional facts CareerOS can rely on accurate and
          complete. This profile is your source of truth—not a resume—and can
          support many future applications.
        </p>
        {user?.primaryEmailAddress?.emailAddress && (
          <p className="mt-4 text-xs font-medium text-slate-400">
            Signed in as {user.primaryEmailAddress.emailAddress}
          </p>
        )}
      </div>

      <EducationSection educations={brain.educations} onMutate={refetch} />
      <ExperienceSection experiences={brain.experiences} onMutate={refetch} />
      <ProjectSection projects={brain.projects} onMutate={refetch} />
      <SkillSection skills={brain.skills} onMutate={refetch} />
    </div>
  );
}
