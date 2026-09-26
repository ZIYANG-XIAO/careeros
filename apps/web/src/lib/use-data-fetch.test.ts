import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "./api";
import { useDataFetch } from "./use-data-fetch";

function createControllablePromise<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useDataFetch", () => {
  it("initial disabled state: enabled=false keeps initialData and does not fetch", () => {
    const fetch = vi.fn(async () => ["loaded"]);

    const { result } = renderHook(() =>
      useDataFetch({
        enabled: false,
        resetKey: "user-a",
        initialData: [] as string[],
        fetch,
        deps: [],
      }),
    );

    expect(result.current.data).toEqual([]);
    expect(result.current.isInitialLoading).toBe(false);
    expect(result.current.loadError).toBeNull();
    expect(result.current.refreshError).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("disabled to enabled transition starts initial loading and loads data", async () => {
    const fetch = vi.fn(async () => ["job-1"]);
    let enabled = false;

    const { result, rerender } = renderHook(() =>
      useDataFetch({
        enabled,
        resetKey: "user-a",
        initialData: [] as string[],
        fetch,
        deps: [],
      }),
    );

    expect(fetch).not.toHaveBeenCalled();

    enabled = true;
    rerender();

    expect(result.current.isInitialLoading).toBe(true);
    expect(result.current.data).toEqual([]);

    await waitFor(() => {
      expect(result.current.isInitialLoading).toBe(false);
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(["job-1"]);
    expect(result.current.loadError).toBeNull();
  });

  it("user logout clears data, errors, and success tracking", async () => {
    const fetch = vi.fn(async () => ["job-1"]);
    let enabled = true;

    const { result, rerender } = renderHook(() =>
      useDataFetch({
        enabled,
        resetKey: "user-a",
        initialData: [] as string[],
        fetch,
        deps: [],
      }),
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(["job-1"]);
    });

    enabled = false;
    rerender();

    expect(result.current.data).toEqual([]);
    expect(result.current.isInitialLoading).toBe(false);
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.loadError).toBeNull();
    expect(result.current.refreshError).toBeNull();
  });

  it("resetKey change resets state and loads new user data", async () => {
    const fetch = vi
      .fn()
      .mockImplementationOnce(async () => ["user-a-job"])
      .mockImplementationOnce(async () => ["user-b-job"]);
    let resetKey = "user-a";

    const { result, rerender } = renderHook(() =>
      useDataFetch({
        enabled: true,
        resetKey,
        initialData: [] as string[],
        fetch,
        deps: [],
      }),
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(["user-a-job"]);
    });

    resetKey = "user-b";
    rerender();

    expect(result.current.data).toEqual([]);
    expect(result.current.isInitialLoading).toBe(true);
    expect(result.current.loadError).toBeNull();
    expect(result.current.refreshError).toBeNull();

    await waitFor(() => {
      expect(result.current.data).toEqual(["user-b-job"]);
    });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("ignores slow request from previous resetKey after user switch", async () => {
    const userAPromise = createControllablePromise<string[]>();
    const fetch = vi
      .fn()
      .mockImplementationOnce(() => userAPromise.promise)
      .mockImplementationOnce(async () => ["user-b-job"]);
    let resetKey = "user-a";

    const { result, rerender } = renderHook(() =>
      useDataFetch({
        enabled: true,
        resetKey,
        initialData: [] as string[],
        fetch,
        deps: [],
      }),
    );

    expect(fetch).toHaveBeenCalledTimes(1);

    resetKey = "user-b";
    rerender();

    expect(result.current.data).toEqual([]);
    expect(result.current.isInitialLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.data).toEqual(["user-b-job"]);
    });

    await act(async () => {
      userAPromise.resolve(["user-a-job"]);
      await Promise.resolve();
    });

    expect(result.current.data).toEqual(["user-b-job"]);
  });

  it("first fetch failure then retry succeeds", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(["recovered"]);

    const { result } = renderHook(() =>
      useDataFetch({
        enabled: true,
        resetKey: "user-a",
        initialData: [] as string[],
        fetch,
        deps: [],
      }),
    );

    await waitFor(() => {
      expect(result.current.loadError).not.toBeNull();
    });

    expect(result.current.data).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(["recovered"]);
    });

    expect(result.current.loadError).toBeNull();
    expect(result.current.isInitialLoading).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("refresh failure preserves previously loaded data", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(["job-1"])
      .mockRejectedValueOnce(
        new ApiError("refresh failed", 503, "unavailable"),
      );
    let dep = 1;

    const { result, rerender } = renderHook(() =>
      useDataFetch({
        enabled: true,
        resetKey: "user-a",
        initialData: [] as string[],
        fetch,
        deps: [dep],
      }),
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(["job-1"]);
    });

    dep = 2;
    rerender();

    await waitFor(() => {
      expect(result.current.refreshError).not.toBeNull();
    });

    expect(result.current.data).toEqual(["job-1"]);
    expect(result.current.loadError).toBeNull();
    expect(result.current.isRefreshing).toBe(false);
  });

  it("does not show previous user data when resetKey changes", async () => {
    const userAPromise = createControllablePromise<string[]>();
    const fetch = vi
      .fn()
      .mockImplementationOnce(() => userAPromise.promise)
      .mockImplementationOnce(async () => ["user-b-job"]);
    let resetKey = "user-a";

    const { result, rerender } = renderHook(() =>
      useDataFetch({
        enabled: true,
        resetKey,
        initialData: [] as string[],
        fetch,
        deps: [],
      }),
    );

    await act(async () => {
      userAPromise.resolve(["user-a-job"]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(["user-a-job"]);
    });

    resetKey = "user-b";
    rerender();

    expect(result.current.data).toEqual([]);
    expect(result.current.data).not.toEqual(["user-a-job"]);
    expect(result.current.isInitialLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.data).toEqual(["user-b-job"]);
    });
  });
});
