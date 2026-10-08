"use client";

import { useAuth } from "@clerk/nextjs";
import { type ReactNode, useCallback, useEffect, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { getCareerBrain } from "@/lib/api";
import { toApiError } from "@/lib/api-error-message";
import { useI18n } from "@/lib/i18n";
import type { CareerBrain } from "@/lib/types";

type CareerBrainState = {
  brain: CareerBrain | null;
  error: string | null;
  refetch: () => Promise<void>;
  retry: () => void;
};

/** Loads the signed-in user's Career Brain; shared by every /me section page. */
function useCareerBrain(): CareerBrainState {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { t } = useI18n();
  const [brain, setBrain] = useState<CareerBrain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const [prevUserId, setPrevUserId] = useState(userId);
  if (userId !== prevUserId) {
    setPrevUserId(userId);
    setBrain(null);
    setError(null);
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (cancelled) return;
        if (!token) {
          setError(t("career.authTokenError"));
          return;
        }
        let data: CareerBrain;
        try {
          data = await getCareerBrain(token);
        } catch (error) {
          // Same single silent retry as useDataFetch for a rejected token.
          if (toApiError(error).category !== "unauthenticated") throw error;
          await new Promise((resolve) => setTimeout(resolve, 800));
          const fresh = await getToken({ skipCache: true });
          if (cancelled || !fresh) return;
          data = await getCareerBrain(fresh);
        }
        if (cancelled) return;
        setBrain(data);
        setError(null);
      } catch {
        if (!cancelled) setError(t("career.loadError"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, getToken, fetchKey, t]);

  const refetch = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      setBrain(await getCareerBrain(token));
      setError(null);
    } catch {
      setError(t("career.loadError"));
    }
  }, [getToken, t]);

  const retry = useCallback(() => {
    setError(null);
    setBrain(null);
    setFetchKey((key) => key + 1);
  }, []);

  return { brain, error, refetch, retry };
}

/** Renders sign-in, loading, and error states; children only once loaded. */
function CareerBrainGate({
  state,
  children,
}: {
  state: CareerBrainState;
  children: (brain: CareerBrain) => ReactNode;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const { t } = useI18n();

  if (!isLoaded) return <Spinner />;
  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-border bg-surface p-8 text-center">
        <h1 className="text-lg font-semibold text-ink">
          {t("career.signInRequired.title")}
        </h1>
        <p className="mt-2 text-sm text-ink-3">
          {t("career.signInRequired.description")}
        </p>
      </div>
    );
  }
  if (state.brain === null && state.error === null) return <Spinner />;
  if (state.error || !state.brain) {
    return (
      <div className="rounded-xl border border-evidence-gap-border bg-evidence-gap-bg p-6 text-center">
        <p className="text-sm font-medium text-[#6F3627]">
          {state.error || t("errors.unknown")}
        </p>
        <button
          type="button"
          onClick={state.retry}
          className="mt-3 text-sm font-medium text-[#8A4530] underline hover:text-[#6F3627]"
        >
          {t("errors.retry")}
        </button>
      </div>
    );
  }
  return <>{children(state.brain)}</>;
}

export { CareerBrainGate, useCareerBrain };
