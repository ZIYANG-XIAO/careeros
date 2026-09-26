import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ResumeImport } from "@/lib/types";
import { ResumeReview } from "./resume-review";

const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockConfirm = vi.fn();

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue("token") }),
}));

vi.mock("@/lib/api", () => ({
  updateResumeDraftItem: (...args: unknown[]) => mockUpdate(...args),
  removeResumeDraftItem: (...args: unknown[]) => mockRemove(...args),
  confirmResumeImport: (...args: unknown[]) => mockConfirm(...args),
}));

const resumeImport: ResumeImport = {
  id: "import-1",
  resume_id: "resume-1",
  resume_name: "base-resume",
  resume_version_id: "version-1",
  version_number: 1,
  status: "READY_FOR_REVIEW",
  error_code: null,
  error_message: null,
  contact_info_candidate: {},
  created_at: "2026-09-20T00:00:00Z",
  confirmed_at: null,
  items: [
    {
      id: "experience-1",
      parent_item_id: null,
      item_type: "EXPERIENCE",
      data: {
        company: "Acme",
        title: "Engineer",
        location: null,
        start_date: "2022",
        end_date: null,
        is_current: true,
        source_text: "Acme Engineer",
      },
      position: 1,
      status: "ACTIVE",
      materialized_source_type: null,
      materialized_source_id: null,
    },
    {
      id: "detail-1",
      parent_item_id: "experience-1",
      item_type: "EXPERIENCE_DETAIL",
      data: { content: "Improved latency", source_text: "Improved latency" },
      position: 2,
      status: "ACTIVE",
      materialized_source_type: null,
      materialized_source_id: null,
    },
  ],
};

describe("ResumeReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockImplementation(
      (
        _token: string,
        _importId: string,
        itemId: string,
        data: Record<string, unknown>,
      ) =>
        Promise.resolve({
          ...resumeImport.items.find((item) => item.id === itemId),
          data,
        }),
    );
    mockRemove.mockImplementation(() =>
      Promise.resolve({ ...resumeImport.items[0], status: "REMOVED" }),
    );
    mockConfirm.mockResolvedValue({
      ...resumeImport,
      status: "CONFIRMED",
      items: resumeImport.items.map((item) => ({
        ...item,
        status: "CONFIRMED",
      })),
    });
  });

  it("shows extracted domains and keeps facts explicitly unconfirmed", () => {
    render(<ResumeReview initialImport={resumeImport} />);
    expect(
      screen.getByRole("heading", { name: "Experience" }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Acme")).toBeInTheDocument();
    expect(
      screen.getByText("Nothing enters your Career Brain until you confirm."),
    ).toBeInTheDocument();
  });

  it("lets the user correct extracted facts", async () => {
    const user = userEvent.setup();
    render(<ResumeReview initialImport={resumeImport} />);
    const company = screen.getByLabelText("Company");
    await user.clear(company);
    await user.type(company, "Acme Labs");
    await user.click(
      screen.getAllByRole("button", { name: "Save correction" })[0],
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      "token",
      "import-1",
      "experience-1",
      expect.objectContaining({ company: "Acme Labs" }),
    );
  });

  it("removing a parent also removes its child from the review", async () => {
    const user = userEvent.setup();
    render(<ResumeReview initialImport={resumeImport} />);
    const experienceSection = screen.getByRole("heading", {
      name: "Experience",
    }).parentElement?.parentElement;
    await user.click(
      within(experienceSection as HTMLElement).getByRole("button", {
        name: "Remove",
      }),
    );
    expect(await screen.findAllByText("Removed from this import")).toHaveLength(
      2,
    );
  });

  it("confirms accepted facts and reports completion", async () => {
    const user = userEvent.setup();
    render(<ResumeReview initialImport={resumeImport} />);
    await user.click(
      screen.getByRole("button", { name: "Confirm accepted facts" }),
    );
    expect(mockConfirm).toHaveBeenCalledWith("token", "import-1", {});
    expect(
      await screen.findByText(/Accepted facts are now in your Career Brain/),
    ).toBeInTheDocument();
  });

  it("shows a safe failure state when confirmation fails", async () => {
    const user = userEvent.setup();
    mockConfirm.mockRejectedValueOnce(new Error("failure"));
    render(<ResumeReview initialImport={resumeImport} />);
    await user.click(
      screen.getByRole("button", { name: "Confirm accepted facts" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Career Brain was not changed",
    );
  });

  it("only applies explicitly selected contact candidates", async () => {
    const user = userEvent.setup();
    const withContacts: ResumeImport = {
      ...resumeImport,
      contact_info_candidate: {
        first_name: "Ada",
        last_name: "Lovelace",
        phone: "+44 1234567",
      },
    };
    render(
      <ResumeReview
        initialImport={withContacts}
        currentContactInfo={{ first_name: "Existing" }}
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: "Use First name" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Use Last name" }),
    ).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Use Phone" }));
    await user.click(
      screen.getByRole("button", { name: "Confirm accepted facts" }),
    );

    expect(mockConfirm).toHaveBeenCalledWith("token", "import-1", {
      last_name: "Lovelace",
    });
  });
});
