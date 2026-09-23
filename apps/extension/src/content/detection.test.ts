// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { detectApplicationPage } from "./detection";

describe("application page detection", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("detects a likely external application without a CareerOS job", () => {
    document.body.innerHTML = `
      <form aria-label="Job application">
        <label>Email <input name="email" /></label>
        <label>Resume <input type="file" name="resume" /></label>
        <button type="submit">Continue application</button>
      </form>
    `;

    expect(
      detectApplicationPage(document, "https://jobs.example.com/apply/123"),
    ).toEqual({
      status: "APPLICATION_PAGE",
      adapter: "generic",
      reasons: ["A likely application form is present."],
    });
  });

  it("does not pretend a page without a form is an application", () => {
    document.body.innerHTML = "<h1>Software Engineer</h1>";

    expect(
      detectApplicationPage(document, "https://jobs.example.com/positions/123"),
    ).toMatchObject({ status: "NOT_APPLICATION_PAGE", adapter: null });
  });

  it("does not treat an unrelated form as an application", () => {
    document.body.innerHTML = `
      <form aria-label="Newsletter">
        <input name="email" />
        <button type="submit">Subscribe</button>
      </form>
    `;

    expect(
      detectApplicationPage(document, "https://example.com/newsletter"),
    ).toMatchObject({ status: "NOT_APPLICATION_PAGE", adapter: null });
  });

  it("rejects privileged browser pages", () => {
    expect(detectApplicationPage(document, "chrome://extensions")).toEqual({
      status: "UNSUPPORTED_PAGE",
      adapter: null,
      reasons: ["CareerOS only inspects normal web pages."],
    });
  });
});
