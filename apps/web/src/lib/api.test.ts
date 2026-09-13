import { afterEach, describe, expect, it, vi } from "vitest";

import { getSystemHealth } from "./api";

describe("getSystemHealth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it("returns typed API and database health", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000/";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok", database: "connected" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSystemHealth()).resolves.toEqual({
      status: "ok",
      database: "connected",
    });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/health", {
      cache: "no-store",
    });
  });

  it("fails clearly when the API URL is missing", async () => {
    await expect(getSystemHealth()).rejects.toThrow(
      "NEXT_PUBLIC_API_URL is required",
    );
  });
});
