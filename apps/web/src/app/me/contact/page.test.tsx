import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n";
import type { ContactInfo, JobPreferences } from "@/lib/types";

import MeContactPage from "./page";

const mockGetContactInfo = vi.fn();
const mockGetJobPreferences = vi.fn();
const mockUpdateJobPreferences = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue("token");

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken: mockGetToken }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/me/contact",
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getContactInfo: (...args: unknown[]) => mockGetContactInfo(...args),
    getJobPreferences: (...args: unknown[]) => mockGetJobPreferences(...args),
    updateJobPreferences: (...args: unknown[]) =>
      mockUpdateJobPreferences(...args),
  };
});

const emptyJobPreferences: JobPreferences = {
  target_roles: [],
  cities: [],
  company_sizes: [],
  industries_include: [],
  industries_exclude: [],
  company_blocklist: [],
  minimum_salary: null,
  security_clearance_interest: false,
};

const contactInfo: ContactInfo = {
  first_name: "Ada",
  last_name: "Lovelace",
  preferred_name: null,
  given_name_native: null,
  family_name_native: null,
  full_name_native: null,
  contact_email: null,
  phone: null,
  wechat_id: null,
  address_line_1: null,
  address_line_2: null,
  city: null,
  district: null,
  region: null,
  postal_code: null,
  country_code: null,
  linkedin_url: null,
  github_url: null,
  portfolio_url: null,
  confirmed_at: "2026-09-01T00:00:00Z",
};

beforeEach(() => {
  mockGetContactInfo.mockReset().mockResolvedValue(contactInfo);
  mockGetJobPreferences.mockReset().mockResolvedValue(emptyJobPreferences);
  mockUpdateJobPreferences.mockReset();
});

describe("MeContactPage", () => {
  it("loads and renders the contact info form with the Me tabs", async () => {
    render(
      <LocaleProvider>
        <MeContactPage />
      </LocaleProvider>,
    );
    expect(await screen.findByDisplayValue("Ada")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Lovelace")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Career Brain" })).toHaveAttribute(
      "href",
      "/me",
    );
    expect(
      screen.getByRole("link", { name: "Contact & answers" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("loads and renders the job preferences form", async () => {
    mockGetJobPreferences.mockResolvedValue({
      ...emptyJobPreferences,
      target_roles: ["Backend Engineer"],
      minimum_salary: 120000,
    });
    render(
      <LocaleProvider>
        <MeContactPage />
      </LocaleProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "Job preferences" }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByDisplayValue("120000")).toBeInTheDocument();
  });

  it("splits comma-separated list fields and parses salary on save", async () => {
    const user = userEvent.setup();
    mockUpdateJobPreferences.mockResolvedValue({
      ...emptyJobPreferences,
      target_roles: ["Backend Engineer", "Platform Engineer"],
      minimum_salary: 100000,
    });
    render(
      <LocaleProvider>
        <MeContactPage />
      </LocaleProvider>,
    );

    const targetRolesInput = await screen.findByLabelText("Target roles");
    await user.type(targetRolesInput, "Backend Engineer, Platform Engineer");
    const salaryInput = screen.getByLabelText("Minimum salary");
    await user.type(salaryInput, "100000");
    await user.click(
      screen.getByRole("button", { name: "Save job preferences" }),
    );

    expect(mockUpdateJobPreferences).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        target_roles: ["Backend Engineer", "Platform Engineer"],
        minimum_salary: 100000,
      }),
    );
  });
});
