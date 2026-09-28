// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { captureCustomAnswers } from "./answer-capture";

const PAGE = `
<form aria-label="Job application">
  <label>First name <input type="text" name="first_name" autocomplete="given-name" value="Ada" /></label>
  <label>Email <input type="email" name="email" autocomplete="email" /></label>
  <label>How did you hear about us? <input type="text" name="source" value=" A friend " /></label>
  <label>Why this team? <textarea name="why"></textarea></label>
  <label>Open to relocation?
    <select name="relocation">
      <option value="">Choose</option>
      <option value="y">Yes</option>
      <option value="n">No</option>
    </select>
  </label>
  <label>Resume <input type="file" name="resume" /></label>
  <button type="submit">Submit application</button>
</form>`;

describe("captureCustomAnswers", () => {
  it("returns only answered custom questions, with visible option text", () => {
    const doc = new DOMParser().parseFromString(PAGE, "text/html");
    doc.querySelector<HTMLSelectElement>("select")!.value = "y";

    const answers = captureCustomAnswers(doc, "https://jobs.example.com/apply");

    expect(
      answers.map(({ question, answer }) => ({ question, answer })),
    ).toEqual([
      { question: "How did you hear about us?", answer: "A friend" },
      { question: "Open to relocation?", answer: "Yes" },
    ]);
  });

  it("returns nothing for an invalid page URL", () => {
    const doc = new DOMParser().parseFromString(PAGE, "text/html");
    expect(captureCustomAnswers(doc, "not a url")).toEqual([]);
  });
});
