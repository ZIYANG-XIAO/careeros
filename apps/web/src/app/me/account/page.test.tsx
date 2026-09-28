import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n";

import AccountPage from "./page";

const mockDeleteAccount = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: vi.fn().mockResolvedValue("token"),
  }),
  useClerk: () => ({ signOut: mockSignOut }),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/me/account" }));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
  };
});

describe("AccountPage", () => {
  beforeEach(() => {
    mockDeleteAccount.mockReset().mockResolvedValue(undefined);
    mockSignOut.mockReset().mockResolvedValue(undefined);
  });

  it("deletes only after the confirmation word is typed, then signs out", async () => {
    render(
      <LocaleProvider>
        <AccountPage />
      </LocaleProvider>,
    );
    const button = screen.getByRole("button", {
      name: "Delete my CareerOS data",
    });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "delete" },
    });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "DELETE" },
    });
    fireEvent.click(button);
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    expect(mockDeleteAccount).toHaveBeenCalledWith("token");
  });
});
