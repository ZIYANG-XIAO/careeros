import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n";
import type { ContactInfo } from "@/lib/types";

import MeContactPage from "./page";

const mockGetContactInfo = vi.fn();
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
  };
});

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
});
