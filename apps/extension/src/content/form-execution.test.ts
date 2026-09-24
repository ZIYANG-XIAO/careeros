// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { FillPlanField } from "../shared/messages";
import { applyFillPlan } from "./form-execution";

function fixture(name: string): Document {
  const html = readFileSync(path.join(process.cwd(), "fixtures", name), "utf8");
  return new DOMParser().parseFromString(html, "text/html");
}

function fill(
  fieldId: string,
  proposedAnswer: string,
  canonicalKey: FillPlanField["canonicalKey"] = "CONTACT_EMAIL",
  controlType: FillPlanField["controlType"] = "EMAIL",
): FillPlanField {
  return {
    fieldId,
    canonicalKey,
    controlType,
    action: "FILL",
    proposedAnswer,
  };
}

describe("safe form execution", () => {
  it("fills only approved blank controls and dispatches framework events", () => {
    const page = fixture("greenhouse-application.html");
    const email = page.querySelector<HTMLInputElement>("#email")!;
    const inputEvent = vi.fn();
    const changeEvent = vi.fn();
    email.addEventListener("input", inputEvent);
    email.addEventListener("change", changeEvent);

    const result = applyFillPlan(
      page,
      "https://boards.greenhouse.io/example/jobs/123",
      [fill("field-0-2", "candidate@example.com")],
    );

    expect(result.fields).toEqual([{ fieldId: "field-0-2", state: "FILLED" }]);
    expect(email.value).toBe("candidate@example.com");
    expect(inputEvent).toHaveBeenCalledOnce();
    expect(changeEvent).toHaveBeenCalledOnce();
    expect(email.getAttribute("data-careeros-field-state")).toBe("FILLED");
    expect(page.body.textContent).toContain("CareerOS filled — review");
  });

  it("never overwrites an existing answer", () => {
    const page = fixture("application-page.html");
    const email = page.querySelector<HTMLInputElement>('input[name="email"]')!;

    const result = applyFillPlan(
      page,
      "https://careers.example.com/jobs/engineer/apply",
      [fill("field-0-2", "different@example.com")],
    );

    expect(result.fields[0].state).toBe("SKIPPED_EXISTING");
    expect(email.value).toBe("not-collected@example.com");
  });

  it("marks review, input, and unresolved fields without entering answers", () => {
    const page = fixture("greenhouse-application.html");
    const fields: FillPlanField[] = [
      {
        fieldId: "field-0-0",
        canonicalKey: "PERSON_FIRST_NAME",
        controlType: "TEXT",
        action: "SUGGEST",
        proposedAnswer: null,
      },
      {
        fieldId: "field-0-1",
        canonicalKey: "PERSON_LAST_NAME",
        controlType: "TEXT",
        action: "ASK",
        proposedAnswer: null,
      },
      {
        fieldId: "field-0-4",
        canonicalKey: null,
        controlType: "TEXTAREA",
        action: "UNKNOWN",
        proposedAnswer: null,
      },
      {
        fieldId: "field-0-3",
        canonicalKey: "RESUME_FILE",
        controlType: "FILE",
        action: "FILL",
        proposedAnswer: "resume.pdf",
      },
    ];

    const result = applyFillPlan(
      page,
      "https://boards.greenhouse.io/example/jobs/123",
      fields,
    );

    expect(result.fields.map((field) => field.state)).toEqual([
      "REVIEW_REQUIRED",
      "INPUT_REQUIRED",
      "UNRESOLVED",
      "REVIEW_REQUIRED",
    ]);
    expect(page.querySelector<HTMLInputElement>("#first_name")!.value).toBe("");
    expect(page.querySelector<HTMLInputElement>("#last_name")!.value).toBe("");
    expect(page.querySelector<HTMLTextAreaElement>("#custom")!.value).toBe("");
    expect(page.querySelector<HTMLInputElement>("#resume")!.files).toHaveLength(
      0,
    );
  });

  it.each([
    [
      "greenhouse-application.html",
      "https://boards.greenhouse.io/example/jobs/123",
      "field-0-2",
      "#email",
      "CONTACT_EMAIL",
      "EMAIL",
    ],
    [
      "lever-application.html",
      "https://jobs.lever.co/example/123/apply",
      "field-0-0",
      'input[name="name"]',
      "PERSON_FULL_NAME",
      "TEXT",
    ],
    [
      "ashby-application.html",
      "https://jobs.ashbyhq.com/example/123/application",
      "field-0-1",
      'input[name="current_company"]',
      "EXPERIENCE_COMPANY",
      "TEXT",
    ],
  ] as const)(
    "executes through the isolated adapter for %s",
    (name, url, fieldId, selector, canonicalKey, controlType) => {
      const page = fixture(name);

      const result = applyFillPlan(page, url, [
        fill(fieldId, "Example value", canonicalKey, controlType),
      ]);

      expect(result.fields[0].state).toBe("FILLED");
      expect(page.querySelector<HTMLInputElement>(selector)!.value).toBe(
        "Example value",
      );
    },
  );

  it("fails closed when a field target no longer exists", () => {
    const page = fixture("greenhouse-application.html");
    const result = applyFillPlan(
      page,
      "https://boards.greenhouse.io/example/jobs/123",
      [fill("field-missing", "value")],
    );

    expect(result.fields).toEqual([
      { fieldId: "field-missing", state: "FAILED" },
    ]);
  });

  it("fails closed when a dynamic page changes the target field", () => {
    const page = fixture("greenhouse-application.html");
    const result = applyFillPlan(
      page,
      "https://boards.greenhouse.io/example/jobs/123",
      [
        fill(
          "field-0-2",
          "candidate@example.com",
          "EXPERIENCE_COMPANY",
          "TEXT",
        ),
      ],
    );

    expect(result.fields[0].state).toBe("FAILED");
    expect(page.querySelector<HTMLInputElement>("#email")!.value).toBe("");
  });

  it("never clicks or submits the application form", () => {
    const page = fixture("greenhouse-application.html");
    const submit = vi.fn((event: Event) => event.preventDefault());
    const click = vi.fn();
    page.querySelector("form")!.addEventListener("submit", submit);
    page
      .querySelector('button[type="submit"]')!
      .addEventListener("click", click);

    applyFillPlan(page, "https://boards.greenhouse.io/example/jobs/123", [
      fill("field-0-2", "candidate@example.com"),
    ]);

    expect(submit).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });
});
