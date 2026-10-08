import type {
  AnalyzeJobResult,
  DraftedAnswer,
  JobMatchSummary,
  PageJob,
  RequirementClassification,
  ResumeFilePayload,
} from "../shared/messages";
import { parseDraftResponse } from "./api-client-jobs";

interface TokenProvider {
  getToken(): Promise<string | null>;
}

type Request = typeof fetch;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const classifications: readonly RequirementClassification[] = [
  "STRONG_EVIDENCE",
  "HIDDEN_EVIDENCE",
  "WEAK_EVIDENCE",
  "GENUINE_GAP",
];

function text(value: unknown, max = 500): string | null {
  return typeof value === "string" && value.trim() ? value.slice(0, max) : null;
}

async function authed(
  tokenProvider: TokenProvider,
): Promise<Record<string, string> | null> {
  const token = await tokenProvider.getToken();
  return token ? { Authorization: `Bearer ${token}` } : null;
}

/** The job behind a page URL, "NOT_FOUND", or null when signed out. */
export async function lookupPageJob(
  apiUrl: string,
  tokenProvider: TokenProvider,
  request: Request,
  pageUrl: string,
): Promise<Omit<PageJob, "logoDataUrl"> | "NOT_FOUND" | null> {
  const headers = await authed(tokenProvider);
  if (!headers) return null;
  const response = await request(
    `${apiUrl}/jobs/lookup?url=${encodeURIComponent(pageUrl)}`,
    { headers },
  );
  if (response.status === 401) return null;
  if (response.status === 404 || response.status === 422) return "NOT_FOUND";
  if (!response.ok)
    throw new Error(`CareerOS lookup failed (${response.status})`);
  const job = (await response.json()) as Record<string, unknown>;
  const id = text(job.id);
  const title = text(job.title);
  const company = text(job.company);
  if (!id || !uuidPattern.test(id) || !title || !company) return "NOT_FOUND";
  const salary = job.salary as Record<string, unknown> | null | undefined;
  const sponsorship = (job.sponsorship as { status?: unknown } | null)?.status;
  return {
    jobId: id,
    title,
    company,
    postedAt: text(job.posted_at),
    salary:
      salary &&
      typeof salary.minimum === "number" &&
      typeof salary.maximum === "number" &&
      (salary.currency === "USD" || salary.currency === "CAD") &&
      (salary.period === "YEAR" || salary.period === "HOUR")
        ? {
            minimum: salary.minimum,
            maximum: salary.maximum,
            currency: salary.currency,
            period: salary.period,
          }
        : null,
    sponsorship:
      sponsorship === "OFFERED" || sponsorship === "NOT_OFFERED"
        ? sponsorship
        : null,
    isCatalog: job.is_catalog === true,
    lastObservedAt: text(job.last_observed_at),
    isSaved: job.is_saved === true,
  };
}

function summarize(analysis: Record<string, unknown>): JobMatchSummary | null {
  if (!Array.isArray(analysis.matches)) return null;
  const requirements = analysis.matches.flatMap((match) => {
    const record = match as Record<string, unknown>;
    const description = text(record.description, 300);
    const classification = record.classification as RequirementClassification;
    return description && classifications.includes(classification)
      ? [{ description, classification }]
      : [];
  });
  const resume = text(analysis.resume_name) ?? "Resume";
  const version =
    typeof analysis.resume_version_number === "number"
      ? ` · v${analysis.resume_version_number}`
      : "";
  return {
    resumeLabel: `${resume}${version}`,
    analyzedAt: text(analysis.created_at) ?? "",
    requirements,
  };
}

/** The latest stored analysis for a job, "NONE" if never analyzed. */
export async function getJobMatch(
  apiUrl: string,
  tokenProvider: TokenProvider,
  request: Request,
  jobId: string,
): Promise<JobMatchSummary | "NONE" | null> {
  const headers = await authed(tokenProvider);
  if (!headers) return null;
  const response = await request(`${apiUrl}/jobs/${jobId}/analyses`, {
    headers,
  });
  if (response.status === 401) return null;
  if (!response.ok)
    throw new Error(`CareerOS analyses failed (${response.status})`);
  const analyses = (await response.json()) as unknown;
  if (!Array.isArray(analyses) || analyses.length === 0) return "NONE";
  return summarize(analyses[0] as Record<string, unknown>) ?? "NONE";
}

/**
 * Runs a new grounded analysis with the chosen resume version, extracting the
 * job's requirements first when a shared catalog posting has none yet.
 */
export async function analyzeJob(
  apiUrl: string,
  tokenProvider: TokenProvider,
  request: Request,
  jobId: string,
  resumeVersionId: string,
): Promise<AnalyzeJobResult | null> {
  const headers = await authed(tokenProvider);
  if (!headers) return null;
  const run = () =>
    request(`${apiUrl}/jobs/${jobId}/analyses`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ resume_version_id: resumeVersionId }),
    });
  let response = await run();
  if (response.status === 409) {
    const extracted = await request(`${apiUrl}/jobs/${jobId}/requirements`, {
      method: "POST",
      headers,
    });
    if (extracted.status === 503) {
      return { status: "REFUSED", reason: "AI_UNAVAILABLE" };
    }
    if (!extracted.ok) {
      return { status: "REFUSED", reason: "REQUIREMENTS_UNAVAILABLE" };
    }
    response = await run();
  }
  if (response.status === 401) return null;
  if (response.status === 503)
    return { status: "REFUSED", reason: "AI_UNAVAILABLE" };
  if (!response.ok) return { status: "REFUSED", reason: "FAILED" };
  const summary = summarize((await response.json()) as Record<string, unknown>);
  return summary
    ? { status: "ANALYZED", summary }
    : { status: "REFUSED", reason: "FAILED" };
}

/** A cover-letter draft grounded in confirmed evidence for one job. */
export async function draftCoverLetter(
  apiUrl: string,
  tokenProvider: TokenProvider,
  request: Request,
  jobId: string,
): Promise<DraftedAnswer | null> {
  const headers = await authed(tokenProvider);
  if (!headers) return null;
  const response = await request(`${apiUrl}/drafts`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "COVER_LETTER", job_id: jobId }),
  });
  return parseDraftResponse(response);
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

/** Renders the user's approved letter as a DOCX ready for an upload field. */
export async function coverLetterFile(
  apiUrl: string,
  tokenProvider: TokenProvider,
  request: Request,
  letter: string,
  filenameHint: string,
): Promise<ResumeFilePayload | null> {
  const headers = await authed(tokenProvider);
  if (!headers) return null;
  const response = await request(`${apiUrl}/drafts/cover-letter-file`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ text: letter, filename_hint: filenameHint }),
  });
  if (response.status === 401) return null;
  if (!response.ok)
    throw new Error(`Cover letter file failed (${response.status})`);
  const disposition = response.headers.get("content-disposition") ?? "";
  const fileName =
    /filename="([^"]+)"/.exec(disposition)?.[1] ?? "Cover letter.docx";
  return {
    fileName,
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    base64: toBase64(await response.arrayBuffer()),
  };
}
