"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import { toApiError } from "./api-error-message";
import type { ApiError } from "./api";

const AUTH_RETRY_DELAY_MS = 800;

export type UseDataFetchOptions<T> = {
  enabled?: boolean;
  resetKey?: string;
  initialData: T;
  fetch: () => Promise<T>;
  deps: readonly unknown[];
};

export type UseDataFetchResult<T> = {
  data: T;
  setData: Dispatch<SetStateAction<T>>;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  loadError: ApiError | null;
  refreshError: ApiError | null;
  retry: () => void;
};

export function useDataFetch<T>({
  enabled = true,
  resetKey,
  initialData,
  fetch: fetchFn,
  deps,
}: UseDataFetchOptions<T>): UseDataFetchResult<T> {
  const [data, setData] = useState(initialData);
  const [isInitialLoading, setIsInitialLoading] = useState(enabled);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [refreshError, setRefreshError] = useState<ApiError | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [hasEverSucceeded, setHasEverSucceeded] = useState(false);
  const [prevSession, setPrevSession] = useState({ enabled, resetKey });
  const [prevRetryNonce, setPrevRetryNonce] = useState(0);
  const fetchRef = useRef(fetchFn);

  useEffect(() => {
    fetchRef.current = fetchFn;
  });

  const retry = useCallback(() => {
    setRetryNonce((c) => c + 1);
  }, []);

  // React's "adjusting state from props" pattern: reset all state when
  // the session identity (enabled / resetKey) changes. This runs during
  // render so no sync-setState-in-effect is needed.
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const sessionChanged =
    prevSession.enabled !== enabled || prevSession.resetKey !== resetKey;
  if (sessionChanged) {
    setPrevSession({ enabled, resetKey });
    setData(initialData);
    setIsInitialLoading(enabled);
    setIsRefreshing(false);
    setLoadError(null);
    setRefreshError(null);
    setHasEverSucceeded(false);
  } else if (retryNonce !== prevRetryNonce) {
    setPrevRetryNonce(retryNonce);
    if (hasEverSucceeded) {
      setIsRefreshing(true);
    } else {
      setIsInitialLoading(true);
    }
  }

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const isRefresh = hasEverSucceeded;

    void (async () => {
      try {
        let result: T;
        try {
          result = await fetchRef.current();
        } catch (error) {
          // A just-minted or just-refreshed session token can be rejected
          // once (clock skew, refresh race). Retry silently a single time
          // before telling the user their session expired.
          if (toApiError(error).category !== "unauthenticated") throw error;
          await new Promise((resolve) =>
            setTimeout(resolve, AUTH_RETRY_DELAY_MS),
          );
          if (cancelled) return;
          result = await fetchRef.current();
        }
        if (cancelled) return;
        setData(result);
        setLoadError(null);
        setRefreshError(null);
        setHasEverSucceeded(true);
      } catch (error) {
        if (cancelled) return;
        const apiError = toApiError(error);
        if (isRefresh) {
          setRefreshError(apiError);
        } else {
          setLoadError(apiError);
        }
      } finally {
        if (!cancelled) {
          setIsInitialLoading(false);
          setIsRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller-owned fetch deps + session lifecycle
  }, [enabled, resetKey, retryNonce, ...deps]);

  // When disabled, return clean initial state directly — no effect-based
  // cleanup needed because the effect returns immediately for !enabled.
  if (!enabled) {
    return {
      data: initialData,
      setData,
      isInitialLoading: false,
      isRefreshing: false,
      loadError: null,
      refreshError: null,
      retry,
    };
  }

  return {
    data,
    setData,
    isInitialLoading,
    isRefreshing,
    loadError,
    refreshError,
    retry,
  };
}
