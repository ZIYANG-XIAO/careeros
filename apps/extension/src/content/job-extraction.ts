import type {
  JobDraft,
  JobDraftCountry,
  JobDraftEmploymentType,
  JobDraftMarket,
  JobDraftWorkplaceType,
} from "../shared/messages";

// Mirrors the API's CreateJobRequest limits so a draft never fails on length.
const MAX_SHORT_TEXT = 500;
const MAX_DESCRIPTION = 100_000;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clean(value: unknown, limit = MAX_SHORT_TEXT): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

function hasType(node: JsonRecord, type: string): boolean {
  const value = node["@type"];
  return Array.isArray(value) ? value.includes(type) : value === type;
}

function* walkJsonLd(value: unknown): Generator<JsonRecord> {
  if (Array.isArray(value)) {
    for (const item of value) yield* walkJsonLd(item);
    return;
  }
  if (!isRecord(value)) return;
  yield value;
  if (Array.isArray(value["@graph"])) yield* walkJsonLd(value["@graph"]);
}

function findJobPosting(doc: Document): JsonRecord | null {
  for (const script of doc.querySelectorAll(
    'script[type="application/ld+json"]',
  )) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script.textContent ?? "");
    } catch {
      continue;
    }
    for (const node of walkJsonLd(parsed)) {
      if (hasType(node, "JobPosting")) return node;
    }
  }
  return null;
}

const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "LI",
  "UL",
  "OL",
  "BR",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "SECTION",
  "TR",
]);

/** Converts untrusted HTML to plain text without executing or attaching it. */
export function htmlToText(html: string): string {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const parts: string[] = [];
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? "");
      return;
    }
    if (!(node instanceof Element)) return;
    if (node.tagName === "SCRIPT" || node.tagName === "STYLE") return;
    const block = BLOCK_TAGS.has(node.tagName);
    if (block) parts.push("\n");
    if (node.tagName === "LI") parts.push("- ");
    node.childNodes.forEach(visit);
    if (block) parts.push("\n");
  };
  parsed.body.childNodes.forEach(visit);
  return normalizeDescription(parts.join(""));
}

function normalizeDescription(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_DESCRIPTION);
}

function first<T>(value: T | T[] | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function postingLocation(posting: JsonRecord): {
  location: string | null;
  country: string;
} {
  const place = first(posting.jobLocation as unknown);
  const address = isRecord(place) ? place.address : undefined;
  if (typeof address === "string") {
    return { location: clean(address) || null, country: "" };
  }
  if (!isRecord(address)) return { location: null, country: "" };
  const countryValue = address.addressCountry;
  const country = clean(
    isRecord(countryValue) ? countryValue.name : countryValue,
  ).toUpperCase();
  const parts = [address.addressLocality, address.addressRegion]
    .map((part) => clean(part))
    .filter(Boolean);
  if (country) parts.push(country);
  return { location: parts.join(", ") || null, country };
}

const COUNTRIES: Record<string, JobDraftCountry> = {
  US: "US",
  USA: "US",
  "UNITED STATES": "US",
  "UNITED STATES OF AMERICA": "US",
  CA: "CA",
  CAN: "CA",
  CANADA: "CA",
  CN: "CN",
  CHN: "CN",
  CHINA: "CN",
  中国: "CN",
};

function marketFor(country: JobDraftCountry): JobDraftMarket {
  if (country === "US" || country === "CA") return "NORTH_AMERICA";
  if (country === "CN") return "CHINA";
  return "UNKNOWN";
}

const EMPLOYMENT: Record<string, JobDraftEmploymentType> = {
  FULL_TIME: "FULL_TIME",
  PART_TIME: "PART_TIME",
  CONTRACTOR: "CONTRACT",
  TEMPORARY: "CONTRACT",
  INTERN: "INTERNSHIP",
};

function employmentType(posting: JsonRecord): JobDraftEmploymentType {
  const value = first(posting.employmentType as unknown);
  const key = clean(value)
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  return EMPLOYMENT[key] ?? "UNKNOWN";
}

function workplaceType(posting: JsonRecord): JobDraftWorkplaceType {
  const value = first(posting.jobLocationType as unknown);
  return clean(value).toUpperCase() === "TELECOMMUTE" ? "REMOTE" : "UNKNOWN";
}

function metaContent(doc: Document, selector: string): string {
  return clean(doc.querySelector(selector)?.getAttribute("content"));
}

function pageDescription(doc: Document): string {
  const root =
    doc.querySelector("main") ?? doc.querySelector("article") ?? doc.body;
  if (!root) return "";
  return normalizeDescription(
    (root as HTMLElement).innerText ?? root.textContent ?? "",
  );
}

/**
 * Builds an editable job draft from the active page. Structured JobPosting
 * data is preferred; otherwise obvious page text is used and the user is
 * expected to correct it before saving. Nothing is sent anywhere from here.
 */
export function extractJobDraft(doc: Document, pageUrl: string): JobDraft {
  const posting = findJobPosting(doc);
  if (posting) {
    const organization = posting.hiringOrganization;
    const { location, country } = postingLocation(posting);
    const countryCode = COUNTRIES[country] ?? "UNKNOWN";
    let description =
      typeof posting.description === "string"
        ? htmlToText(posting.description)
        : "";
    // Some boards HTML-escape the description inside JSON-LD, so one parse
    // still leaves markup behind.
    if (/<\/?[a-z][^>]*>/i.test(description)) {
      description = htmlToText(description);
    }
    return {
      pageUrl,
      extraction: "STRUCTURED_DATA",
      title: clean(posting.title),
      company: clean(isRecord(organization) ? organization.name : organization),
      location,
      description: description || pageDescription(doc),
      market: marketFor(countryCode),
      countryCode,
      workplaceType: workplaceType(posting),
      employmentType: employmentType(posting),
    };
  }

  return {
    pageUrl,
    extraction: "PAGE_TEXT",
    title:
      clean(doc.querySelector("h1")?.textContent) ||
      metaContent(doc, 'meta[property="og:title"]') ||
      clean(doc.title),
    company: metaContent(doc, 'meta[property="og:site_name"]'),
    location: null,
    description: pageDescription(doc),
    market: "UNKNOWN",
    countryCode: "UNKNOWN",
    workplaceType: "UNKNOWN",
    employmentType: "UNKNOWN",
  };
}
