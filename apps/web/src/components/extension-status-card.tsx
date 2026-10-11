"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

import { LoadErrorBanner } from "@/components/load-error-banner";
import { Button } from "@/components/ui/button";
import { getExtensionPresence } from "@/lib/api";
import { intlLocale, useI18n } from "@/lib/i18n";
import type { ExtensionPresence } from "@/lib/types";
import { useDataFetch } from "@/lib/use-data-fetch";

const EMPTY: ExtensionPresence = { last_seen_at: null, build_version: null };

/**
 * Shows whether the signed-in extension has reported to the API. The page
 * cannot ask the extension directly, so this reflects its last report — sent
 * each time the popup opens while signed in.
 */
export function ExtensionStatusCard() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const { t, locale } = useI18n();

  const fetchPresence = useCallback(async () => {
    const token = await getToken();
    if (!token) return EMPTY;
    return getExtensionPresence(token);
  }, [getToken]);

  const { data, isInitialLoading, isRefreshing, loadError, retry } =
    useDataFetch<ExtensionPresence>({
      enabled: isLoaded && Boolean(isSignedIn),
      resetKey: userId ?? undefined,
      initialData: EMPTY,
      fetch: fetchPresence,
      deps: [getToken, isLoaded, isSignedIn],
    });

  if (isLoaded && !isSignedIn) return null;

  const connected = data.last_seen_at !== null;

  return (
    <section
      aria-labelledby="extension-status-title"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <h2
        id="extension-status-title"
        className="text-base font-semibold text-slate-950"
      >
        {t("setup.status.title")}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
        {isInitialLoading ? (
          <p role="status">{t("setup.status.checking")}</p>
        ) : loadError ? (
          <LoadErrorBanner error={loadError} onRetry={retry} t={t} />
        ) : (
          <>
            <p className="flex items-center gap-2 font-medium text-slate-900">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 rounded-full ${
                  connected ? "bg-emerald-500" : "bg-slate-300"
                }`}
              />
              {connected
                ? t("setup.status.connected")
                : t("setup.status.notDetected")}
            </p>
            {connected && data.last_seen_at && data.build_version ? (
              <p>
                {t("setup.status.lastSeen", {
                  time: new Intl.DateTimeFormat(intlLocale(locale), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(data.last_seen_at)),
                  version: data.build_version,
                })}
              </p>
            ) : (
              <p>{t("setup.status.notDetectedHint")}</p>
            )}
            <Button variant="secondary" onClick={retry} disabled={isRefreshing}>
              {t("setup.status.checkAgain")}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
