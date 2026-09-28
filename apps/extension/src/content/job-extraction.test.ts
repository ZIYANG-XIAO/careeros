// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { extractJobDraft, htmlToText } from "./job-extraction";

function docWith(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

const URL = "https://boards.greenhouse.io/acme/jobs/42";

describe("extractJobDraft", () => {
  it("prefers structured JobPosting data, including @graph wrappers", () => {
    const posting = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Organization", name: "Ignore me" },
        {
          "@type": "JobPosting",
          title: " Senior  Backend Engineer ",
          hiringOrganization: { "@type": "Organization", name: "Acme" },
          jobLocation: {
            "@type": "Place",
            address: {
              addressLocality: "Toronto",
              addressRegion: "ON",
              addressCountry: "CA",
            },
          },
          employmentType: ["FULL_TIME"],
          jobLocationType: "TELECOMMUTE",
          description:
            "<p>Build APIs.</p><ul><li>5+ years Python</li><li>SQL</li></ul>",
        },
      ],
    };
    const draft = extractJobDraft(
      docWith(
        `<script type="application/ld+json">${JSON.stringify(posting)}</script><h1>Other</h1>`,
      ),
      URL,
    );
    expect(draft).toEqual({
      pageUrl: URL,
      extraction: "STRUCTURED_DATA",
      title: "Senior Backend Engineer",
      company: "Acme",
      location: "Toronto, ON, CA",
      description: "Build APIs.\n\n- 5+ years Python\n\n- SQL",
      market: "NORTH_AMERICA",
      countryCode: "CA",
      workplaceType: "REMOTE",
      employmentType: "FULL_TIME",
    });
  });

  it("skips malformed JSON-LD and falls back to page text", () => {
    const draft = extractJobDraft(
      docWith(
        `<head><meta property="og:site_name" content="Globex"></head>
         <script type="application/ld+json">{not json</script>
         <main><h1>Data Engineer</h1><p>Own the warehouse.</p></main>`,
      ),
      URL,
    );
    expect(draft.extraction).toBe("PAGE_TEXT");
    expect(draft.title).toBe("Data Engineer");
    expect(draft.company).toBe("Globex");
    expect(draft.description).toContain("Own the warehouse.");
    expect(draft.market).toBe("UNKNOWN");
  });

  it("decodes HTML-escaped descriptions and never keeps script content", () => {
    expect(htmlToText("&lt;p&gt;Hi&lt;/p&gt;<script>alert(1)</script>")).toBe(
      "<p>Hi</p>",
    );
    const posting = {
      "@type": "JobPosting",
      title: "X",
      hiringOrganization: "Initech",
      description: "&lt;p&gt;Escaped body text here&lt;/p&gt;",
    };
    const draft = extractJobDraft(
      docWith(
        `<script type="application/ld+json">${JSON.stringify([posting])}</script>`,
      ),
      URL,
    );
    expect(draft.company).toBe("Initech");
    expect(draft.description).toBe("Escaped body text here");
  });
});
