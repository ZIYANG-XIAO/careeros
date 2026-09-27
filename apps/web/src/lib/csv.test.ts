import { describe, expect, it } from "vitest";

import { parseCsv, toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes fields containing commas, quotes, or newlines", () => {
    const csv = toCsv([
      ["Company", "Notes"],
      ["Acme, Inc.", 'Said "hello"\nagain'],
    ]);
    expect(csv).toBe('Company,Notes\r\n"Acme, Inc.","Said ""hello""\nagain"');
  });
});

describe("parseCsv", () => {
  it("parses a simple grid", () => {
    expect(parseCsv("a,b,c\r\n1,2,3\r\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with embedded commas, quotes, and newlines", () => {
    const text = 'Company,Notes\r\n"Acme, Inc.","Said ""hello""\nagain"\r\n';
    expect(parseCsv(text)).toEqual([
      ["Company", "Notes"],
      ["Acme, Inc.", 'Said "hello"\nagain'],
    ]);
  });

  it("strips a leading BOM and drops trailing blank lines", () => {
    expect(parseCsv("﻿a,b\r\n1,2\r\n\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("round-trips through toCsv", () => {
    const rows = [
      ["Company", "Role", "Status"],
      ["Acme, Inc.", 'Senior "Staff" Engineer', "APPLIED"],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
