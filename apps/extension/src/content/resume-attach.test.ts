// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { detectApplicationPage } from "./detection";
import { attachResumeFile } from "./resume-attach";

const URL = "https://jobs.example.com/apply";
const PAYLOAD = {
  fileName: "Ada Resume.pdf",
  contentType: "application/pdf",
  base64: btoa("%PDF-1.4 test"),
};

function page(accept = ".pdf,.docx"): Document {
  return new DOMParser().parseFromString(
    `<form aria-label="Job application">
      <label>First name <input type="text" name="first_name" autocomplete="given-name" /></label>
      <label>Email <input type="email" name="email" autocomplete="email" /></label>
      <label>Resume/CV <input type="file" name="resume" accept="${accept}" /></label>
      <button type="submit">Submit application</button>
    </form>`,
    "text/html",
  );
}

function resumeFieldId(doc: Document): string {
  const field = detectApplicationPage(doc, URL)
    .forms.flatMap((form) => form.fields)
    .find((candidate) => candidate.canonicalKey === "RESUME_FILE");
  if (!field) throw new Error("fixture has no resume field");
  return field.id;
}

function stubFileTransfer(input: HTMLInputElement) {
  let files: File[] = [];
  Object.defineProperty(input, "files", {
    configurable: true,
    get: () => files,
    set: (value: File[]) => {
      files = value;
    },
  });
  class FakeDataTransfer {
    private readonly list: File[] = [];
    items = { add: (file: File) => this.list.push(file) };
    get files() {
      return this.list;
    }
  }
  vi.stubGlobal("DataTransfer", FakeDataTransfer);
  return () => files;
}

afterEach(() => vi.unstubAllGlobals());

describe("attachResumeFile", () => {
  it("attaches the exact file to an empty resume control and notifies the page", () => {
    const doc = page();
    const input = doc.querySelector<HTMLInputElement>('input[type="file"]')!;
    const current = stubFileTransfer(input);
    const change = vi.fn();
    input.addEventListener("change", change);

    const result = attachResumeFile(doc, URL, resumeFieldId(doc), PAYLOAD);

    expect(result.state).toBe("FILLED");
    expect(current()[0].name).toBe("Ada Resume.pdf");
    expect(current()[0].type).toBe("application/pdf");
    expect(change).toHaveBeenCalledOnce();
  });

  it("keeps a file the user already chose", () => {
    const doc = page();
    const input = doc.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", {
      get: () => [new File(["x"], "mine.pdf")],
    });
    expect(attachResumeFile(doc, URL, resumeFieldId(doc), PAYLOAD).state).toBe(
      "SKIPPED_EXISTING",
    );
  });

  it("refuses a file type the control does not accept and unknown fields", () => {
    const doc = page(".docx");
    stubFileTransfer(
      doc.querySelector<HTMLInputElement>('input[type="file"]')!,
    );
    expect(attachResumeFile(doc, URL, resumeFieldId(doc), PAYLOAD).state).toBe(
      "FAILED",
    );
    expect(attachResumeFile(doc, URL, "nope", PAYLOAD).state).toBe("FAILED");
  });
});
