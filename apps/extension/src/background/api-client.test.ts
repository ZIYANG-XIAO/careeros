import { describe, expect, it, vi } from "vitest";

import { CareerOsApiClient } from "./api-client";

describe("CareerOsApiClient", () => {
  it("uses a short-lived bearer token only in the API request", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ id: "user-1", email: "private@example.com" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const client = new CareerOsApiClient(
      "http://localhost:8000",
      { getToken: vi.fn().mockResolvedValue("secret-session-token") },
      request,
    );

    const status = await client.getAuthStatus();
    expect(status).toEqual({ authenticated: true });
    expect(request).toHaveBeenCalledWith("http://localhost:8000/me", {
      headers: { Authorization: "Bearer secret-session-token" },
    });
    expect(JSON.stringify(status)).not.toContain("secret-session-token");
  });

  it("does not call the API without a session", async () => {
    const request = vi.fn();
    const client = new CareerOsApiClient(
      "http://localhost:8000",
      { getToken: vi.fn().mockResolvedValue(null) },
      request,
    );

    await expect(client.getAuthStatus()).resolves.toEqual({
      authenticated: false,
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("treats an API rejection as signed out", async () => {
    const client = new CareerOsApiClient(
      "http://localhost:8000",
      { getToken: vi.fn().mockResolvedValue("expired") },
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );

    await expect(client.getAuthStatus()).resolves.toEqual({
      authenticated: false,
    });
  });
});
