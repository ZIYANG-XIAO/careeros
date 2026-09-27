import { beforeEach, describe, expect, it, vi } from "vitest";

import { ONBOARDING_SKIP_COOKIE } from "./onboarding";

const mockListResumes = vi.fn();
const mockGetCareerBrain = vi.fn();
const mockCookieGet = vi.fn();

vi.mock("./api", () => ({
  listResumes: (...args: unknown[]) => mockListResumes(...args),
  getCareerBrain: (...args: unknown[]) => mockGetCareerBrain(...args),
}));

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: mockCookieGet }),
}));

const emptyBrain = {
  id: "brain-1",
  created_at: "2026-01-01T00:00:00Z",
  educations: [],
  experiences: [],
  projects: [],
  skills: [],
};

describe("resolveHomeRedirect", () => {
  beforeEach(() => {
    mockListResumes.mockReset().mockResolvedValue([]);
    mockGetCareerBrain.mockReset().mockResolvedValue(emptyBrain);
    mockCookieGet.mockReset().mockReturnValue(undefined);
  });

  it("sends new users without profile data to start", async () => {
    const { resolveHomeRedirect } = await import("./home-routing");
    await expect(resolveHomeRedirect("token", "user-1")).resolves.toBe(
      "/start",
    );
  });

  it("sends returning users with profile data to pipeline", async () => {
    mockListResumes.mockResolvedValue([
      {
        id: "resume-1",
        name: "Base resume",
        type: "BASE",
        is_primary: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        versions: [{ id: "version-1" }],
      },
    ]);

    const { resolveHomeRedirect } = await import("./home-routing");
    await expect(resolveHomeRedirect("token", "user-1")).resolves.toBe(
      "/pipeline",
    );
  });

  it("falls back to start when profile lookup fails", async () => {
    mockListResumes.mockRejectedValue(new Error("network"));

    const { resolveHomeRedirect } = await import("./home-routing");
    await expect(resolveHomeRedirect("token", "user-1")).resolves.toBe(
      "/start",
    );
  });

  it("skips to pipeline when skip cookie matches current user", async () => {
    mockCookieGet.mockImplementation((name: string) =>
      name === ONBOARDING_SKIP_COOKIE ? { value: "user-1" } : undefined,
    );

    const { resolveHomeRedirect } = await import("./home-routing");
    await expect(resolveHomeRedirect("token", "user-1")).resolves.toBe(
      "/pipeline",
    );
    expect(mockListResumes).not.toHaveBeenCalled();
  });

  it("ignores skip cookie from a different user", async () => {
    mockCookieGet.mockImplementation((name: string) =>
      name === ONBOARDING_SKIP_COOKIE ? { value: "user-old" } : undefined,
    );

    const { resolveHomeRedirect } = await import("./home-routing");
    await expect(resolveHomeRedirect("token", "user-new")).resolves.toBe(
      "/start",
    );
    expect(mockListResumes).toHaveBeenCalled();
  });

  it("proceeds to profile check when no skip cookie exists", async () => {
    mockCookieGet.mockReturnValue(undefined);

    const { resolveHomeRedirect } = await import("./home-routing");
    await expect(resolveHomeRedirect("token", "user-1")).resolves.toBe(
      "/start",
    );
    expect(mockListResumes).toHaveBeenCalled();
  });
});
