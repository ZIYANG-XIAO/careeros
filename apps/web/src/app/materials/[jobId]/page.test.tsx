import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";
import { LocaleProvider } from "@/lib/i18n";
import type { Job, ResumeSummary } from "@/lib/types";

import MaterialsPage from "./page";

const mockGetJob = vi.fn();
const mockListResumes = vi.fn();
const mockSuggest = vi.fn();
const mockCreateVersion = vi.fn();
const mockCreateDraft = vi.fn();
const mockPrep = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue("token");
const mockReplace = vi.fn();
let currentSearch = "";

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: mockGetToken,
    userId: "user-1",
  }),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ jobId: "job-1" }),
  usePathname: () => "/materials/job-1",
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getJob: (...args: unknown[]) => mockGetJob(...args),
    listResumes: (...args: unknown[]) => mockListResumes(...args),
    suggestTailoring: (...args: unknown[]) => mockSuggest(...args),
    createTailoredVersion: (...args: unknown[]) => mockCreateVersion(...args),
    createDraft: (...args: unknown[]) => mockCreateDraft(...args),
    getInterviewPrep: (...args: unknown[]) => mockPrep(...args),
  };
});

const job = {
  id: "job-1",
  company: "Stripe",
  title: "Platform Engineer",
} as Job;

const resumes: ResumeSummary[] = [
  {
    id: "resume-1",
    name: "Backend Resume",
    type: "BASE",
    is_primary: true,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    versions: [
      {
        id: "version-1",
        version_number: 1,
        source: "UPLOADED",
        created_by: "USER",
        source_version_id: null,
        original_filename: "cv.docx",
        content_type: "x",
        size_bytes: 1,
        sha256: "x",
        parser_version: "v1",
        extracted_text: "Backend engineer",
        structured_content: {},
        created_at: "2026-09-01T00:00:00Z",
      },
    ],
  },
];

const kafka = { revision_id: "rev-1", content: '{"name": "Kafka"}' };

function renderPage() {
  return render(
    <LocaleProvider>
      <MaterialsPage />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  currentSearch = "";
  mockGetJob.mockReset().mockResolvedValue(job);
  mockListResumes.mockReset().mockResolvedValue(resumes);
  mockSuggest.mockReset();
  mockCreateVersion.mockReset();
  mockCreateDraft.mockReset();
  mockPrep.mockReset();
});

describe("MaterialsPage", () => {
  it("creates a tailored version only from the edits the user accepts", async () => {
    const user = userEvent.setup();
    mockSuggest.mockResolvedValue({
      base_resume_version_id: "version-1",
      dropped_count: 2,
      writer_version: "v1",
      suggestions: [
        {
          kind: "REWRITE",
          original_text: "Backend engineer",
          insert_after: null,
          suggested_text: "Backend engineer working with Kafka",
          rationale: "Surfaces Kafka.",
          requirements: [{ id: "req-1", description: "Kafka experience" }],
          evidence: [kafka],
        },
        {
          kind: "INSERT",
          original_text: null,
          insert_after: "Backend engineer",
          suggested_text: "Ran Docker in production",
          rationale: "Adds Docker.",
          requirements: [{ id: "req-2", description: "Containers" }],
          evidence: [{ revision_id: "rev-2", content: "Docker" }],
        },
      ],
    });
    mockCreateVersion.mockResolvedValue({
      resume_id: "resume-1",
      resume_version_id: "version-2",
      version_number: 2,
      original_filename: "cv - Stripe.docx",
    });
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Suggest edits" }),
    );
    expect(mockSuggest).toHaveBeenCalledWith("token", "job-1", "version-1");
    expect(
      await screen.findByText(/2 suggestion\(s\) failed the fact check/),
    ).toBeInTheDocument();
    // JSON evidence is shown as readable text.
    expect(screen.getByText("Kafka")).toBeInTheDocument();

    const [first] = screen.getAllByRole("checkbox");
    await user.click(first);
    const editor = screen.getAllByRole("textbox", {
      name: "Suggested wording (editable)",
    })[0];
    await user.clear(editor);
    await user.type(editor, "Backend engineer, Kafka pipelines");
    await user.click(
      screen.getByRole("button", { name: "Create tailored version" }),
    );

    expect(mockCreateVersion).toHaveBeenCalledWith("token", {
      base_resume_version_id: "version-1",
      job_id: "job-1",
      edits: [
        {
          kind: "REWRITE",
          original_text: "Backend engineer",
          insert_after: null,
          text: "Backend engineer, Kafka pipelines",
        },
      ],
    });
    expect(
      await screen.findByText("Created version 2: cv - Stripe.docx"),
    ).toBeInTheDocument();
  });

  it("shows unsupported points and explains sensitive-question refusals", async () => {
    currentSearch = "tab=drafts";
    const user = userEvent.setup();
    mockCreateDraft.mockResolvedValueOnce({
      kind: "COVER_LETTER",
      text: "Dear Stripe team,",
      evidence: [kafka],
      unsupported_points: ["GCP production experience"],
      writer_version: "v1",
    });
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Write draft" }),
    );
    expect(
      await screen.findByDisplayValue("Dear Stripe team,"),
    ).toBeInTheDocument();
    expect(screen.getByText("GCP production experience")).toBeInTheDocument();

    mockCreateDraft.mockRejectedValueOnce(
      new ApiError("x", 422, "validation", undefined, "SENSITIVE_QUESTION"),
    );
    await user.click(
      screen.getByRole("radio", { name: "Application question" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Question" }),
      "Do you need sponsorship?",
    );
    await user.click(screen.getByRole("button", { name: "Write again" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "CareerOS never drafts it",
    );
  });

  it("renders an interview prep plan with honest gap framing", async () => {
    currentSearch = "tab=prep";
    const user = userEvent.setup();
    mockPrep.mockResolvedValue({
      stories: [
        {
          prompt: "Tell the Kafka migration story.",
          requirements: [{ id: "req-1", description: "Kafka experience" }],
          evidence: [kafka],
        },
      ],
      questions: [
        {
          question: "How do you handle consumer lag?",
          requirements: [{ id: "req-1", description: "Kafka experience" }],
          evidence: [],
        },
      ],
      gaps: [
        {
          requirement: { id: "req-3", description: "GCP production" },
          honest_framing: "Say you have not run GCP in production.",
        },
      ],
      dropped_count: 0,
      writer_version: "v1",
    });
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Build prep plan" }),
    );
    expect(
      await screen.findByText("Tell the Kafka migration story."),
    ).toBeInTheDocument();
    const gaps = screen
      .getByRole("heading", { name: "Gaps to address honestly" })
      .closest("section")!;
    expect(
      within(gaps).getByText("Say you have not run GCP in production."),
    ).toBeInTheDocument();
  });
});
