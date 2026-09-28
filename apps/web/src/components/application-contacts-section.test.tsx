import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n";

import { ApplicationContactsSection } from "./application-contacts-section";

const mockList = vi.fn();
const mockCreate = vi.fn();
const mockDelete = vi.fn();

const mockGetToken = vi.fn().mockResolvedValue("token");

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    listApplicationContacts: (...args: unknown[]) => mockList(...args),
    createApplicationContact: (...args: unknown[]) => mockCreate(...args),
    deleteApplicationContact: (...args: unknown[]) => mockDelete(...args),
  };
});

const recruiter = {
  id: "c1",
  application_id: "app-1",
  name: "Jordan Lee",
  relationship_type: "RECRUITER" as const,
  email: "jordan@example.com",
  profile_url: null,
  notes: null,
  created_at: "2026-09-28T00:00:00Z",
  updated_at: "2026-09-28T00:00:00Z",
};

function renderSection() {
  render(
    <LocaleProvider>
      <ApplicationContactsSection applicationId="app-1" />
    </LocaleProvider>,
  );
}

describe("ApplicationContactsSection", () => {
  beforeEach(() => {
    mockList.mockReset().mockResolvedValue([recruiter]);
    mockCreate.mockReset();
    mockDelete.mockReset().mockResolvedValue(undefined);
  });

  it("lists, adds, and removes people", async () => {
    renderSection();
    expect(await screen.findByText("Jordan Lee")).toBeInTheDocument();

    mockCreate.mockResolvedValue({
      ...recruiter,
      id: "c2",
      name: "Sam Park",
      relationship_type: "REFERRER",
      email: null,
    });
    fireEvent.click(screen.getByRole("button", { name: "Add person" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Sam Park" },
    });
    fireEvent.change(screen.getByLabelText("Relationship"), {
      target: { value: "REFERRER" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save person" }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(await screen.findByText("Sam Park")).toBeInTheDocument();
    expect(mockCreate).toHaveBeenCalledWith(
      "token",
      "app-1",
      expect.objectContaining({
        name: "Sam Park",
        relationship_type: "REFERRER",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove Jordan Lee" }));
    await waitFor(() =>
      expect(screen.queryByText("Jordan Lee")).not.toBeInTheDocument(),
    );
  });
});
