import { describe, expect, it } from "vitest";

import { safeExternalUrl } from "./external-url";

describe("safeExternalUrl", () => {
  it("accepts HTTP and HTTPS application links", () => {
    expect(safeExternalUrl("https://jobs.example.com/apply")).toBe(
      "https://jobs.example.com/apply",
    );
    expect(safeExternalUrl("http://localhost:4000/apply")).toBe(
      "http://localhost:4000/apply",
    );
  });

  it("rejects unsafe, credentialed, and malformed links", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("https://user:secret@example.com/apply")).toBeNull();
    expect(safeExternalUrl("not a url")).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
  });
});
