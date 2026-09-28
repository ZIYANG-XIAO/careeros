import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n";

import { JobSearchGoalsManager } from "./job-search-goals-manager";

const mockCreateJobSearchGoal = vi.fn();
const mockUpdateJobSearchGoal = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue("token");

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}));

vi.mock("@/lib/api", () => ({
  createJobSearchGoal: (...args: unknown[]) => mockCreateJobSearchGoal(...args),
  updateJobSearchGoal: (...args: unknown[]) => mockUpdateJobSearchGoal(...args),
}));

describe("JobSearchGoalsManager", () => {
  beforeEach(() => {
    mockCreateJobSearchGoal.mockReset();
    mockUpdateJobSearchGoal.mockReset();
  });

  it("creates a China goal with market-specific country and currency", async () => {
    mockCreateJobSearchGoal.mockResolvedValue({
      id: "goal-1",
      name: "上海产品岗位",
      market: "CHINA",
      country_codes: ["CN"],
      target_roles: ["产品经理"],
      cities: ["上海"],
      workplace_types: [],
      employment_types: ["FULL_TIME"],
      company_sizes: [],
      industries_include: [],
      industries_exclude: [],
      company_blocklist: [],
      minimum_salary: 35000,
      salary_currency: "CNY",
      default_resume_id: null,
      security_clearance_interest: false,
      is_active: true,
      created_at: "2026-09-28T00:00:00Z",
      updated_at: "2026-09-28T00:00:00Z",
    });
    const user = userEvent.setup();
    render(
      <LocaleProvider>
        <JobSearchGoalsManager initialGoals={[]} resumes={[]} />
      </LocaleProvider>,
    );

    await user.type(screen.getByLabelText("Goal name"), "上海产品岗位");
    await user.selectOptions(screen.getByLabelText("Job market"), "CHINA");
    await user.type(screen.getByLabelText("Target roles"), "产品经理");
    await user.type(screen.getByLabelText("Cities or regions"), "上海");
    await user.type(screen.getByLabelText("Minimum salary"), "35000");
    await user.click(screen.getByRole("button", { name: "Save goal" }));

    expect(mockCreateJobSearchGoal).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        name: "上海产品岗位",
        market: "CHINA",
        country_codes: ["CN"],
        target_roles: ["产品经理"],
        cities: ["上海"],
        minimum_salary: 35000,
        salary_currency: "CNY",
      }),
    );
    expect(await screen.findByText("上海产品岗位")).toBeInTheDocument();
  });
});
