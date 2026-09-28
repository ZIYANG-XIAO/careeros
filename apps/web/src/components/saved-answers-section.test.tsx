import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";
import { LocaleProvider } from "@/lib/i18n";

import { SavedAnswersSection } from "./saved-answers-section";

const mockList = vi.fn();
const mockSave = vi.fn();
const mockRevoke = vi.fn();

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    userId: "user-1",
    getToken: vi.fn().mockResolvedValue("token"),
  }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    listReusableAnswers: (...args: unknown[]) => mockList(...args),
    saveReusableAnswer: (...args: unknown[]) => mockSave(...args),
    revokeReusableAnswer: (...args: unknown[]) => mockRevoke(...args),
  };
});

const saved = {
  id: "a1",
  question_text: "How did you hear about us?",
  answer_text: "A friend",
  created_at: "2026-09-28T00:00:00Z",
};

function renderSection() {
  return render(
    <LocaleProvider>
      <SavedAnswersSection />
    </LocaleProvider>,
  );
}

describe("SavedAnswersSection", () => {
  beforeEach(() => {
    mockList.mockReset().mockResolvedValue([saved]);
    mockSave.mockReset();
    mockRevoke.mockReset().mockResolvedValue(undefined);
  });

  it("lists saved answers and removes one on request", async () => {
    renderSection();
    expect(await screen.findByText("A friend")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove saved answer to: How did you hear about us?",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText("A friend")).not.toBeInTheDocument(),
    );
    expect(mockRevoke).toHaveBeenCalledWith("token", "a1");
  });

  it("explains why a sensitive question was refused", async () => {
    mockSave.mockRejectedValue(
      new ApiError("x", 422, "validation", undefined, "SENSITIVE_QUESTION"),
    );
    renderSection();
    await screen.findByText("A friend");
    fireEvent.change(screen.getByLabelText("Question"), {
      target: { value: "Do you need visa sponsorship?" },
    });
    fireEvent.change(screen.getByLabelText("Answer"), {
      target: { value: "No" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save answer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "sensitive question",
    );
  });
});
