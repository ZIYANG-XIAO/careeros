// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { detectApplicationPage } from "../detection";
import { selectFormAdapter } from "./registry";

function fixture(): Document {
  const html = readFileSync(
    path.join(process.cwd(), "fixtures", "workday-application.html"),
    "utf8",
  );
  return new DOMParser().parseFromString(html, "text/html");
}

const URL_ =
  "https://example.wd5.myworkdayjobs.com/en-US/careers/job/123/apply";

describe("Workday adapter", () => {
  it("is selected for Workday hosts only", () => {
    const doc = fixture();
    expect(selectFormAdapter(doc, new URL(URL_)).id).toBe("workday");
    expect(
      selectFormAdapter(doc, new URL("https://example.com/careers")).id,
    ).toBe("generic");
  });

  it("finds the formless apply step once and maps its standard fields", () => {
    const detection = detectApplicationPage(fixture(), URL_);
    expect(detection.status).toBe("APPLICATION_PAGE");
    expect(detection.adapter).toBe("workday");
    expect(detection.forms).toHaveLength(1);
    const byQuestion = Object.fromEntries(
      detection.forms[0].fields.map((field) => [
        field.question?.replace(/\s*\*$/, ""),
        field.canonicalKey,
      ]),
    );
    expect(byQuestion).toMatchObject({
      "First Name": "PERSON_FIRST_NAME",
      "Last Name": "PERSON_LAST_NAME",
      "Address Line 1": "ADDRESS_LINE_1",
      City: "ADDRESS_CITY",
      "Postal Code": "ADDRESS_POSTAL_CODE",
      "Email Address": "CONTACT_EMAIL",
      "Phone Number": "CONTACT_PHONE",
      "How Did You Hear About Us?": null,
      "Resume/CV": "RESUME_FILE",
    });
  });
});
