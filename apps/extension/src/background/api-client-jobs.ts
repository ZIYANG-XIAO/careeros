import type {
  ClipJobRequestData,
  ClippedJob,
  DraftAnswerRequestData,
  DraftedAnswer,
  ResumeFilePayload,
  ReusableAnswerInput,
  SavedReusableAnswers,
} from "../shared/messages";

interface TokenProvider {
  getToken(): Promise<string | null>;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Saves a user-confirmed job draft. The page URL comes from the verified tab,
 * never from the draft, so the saved identity always matches the real page.
 */
export async function clipJob(
  apiUrl: string,
  tokenProvider: TokenProvider,
  request: typeof fetch,
  input: ClipJobRequestData,
  pageUrl: string,
): Promise<ClippedJob | null> {
  const token = await tokenProvider.getToken();
  if (!token) return null;
  const response = await request(`${apiUrl}/jobs/clip`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      company: input.company.trim(),
      title: input.title.trim(),
      location: input.location?.trim() || null,
      description: input.description.trim(),
      source_url: pageUrl,
      market: input.market,
      country_code: input.countryCode,
      workplace_type: input.workplaceType,
      employment_type: input.employmentType,
    }),
  });
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`CareerOS could not save this job (${response.status})`);
  }
  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { created?: unknown }).created !== "boolean"
  ) {
    throw new Error("CareerOS returned an invalid saved job");
  }
  const job = (
    body as {
      job?: {
        id?: unknown;
        title?: unknown;
        company?: unknown;
        is_catalog?: unknown;
        last_observed_at?: unknown;
        posted_at?: unknown;
        sponsorship?: { status?: unknown } | null;
      };
    }
  ).job;
  if (typeof job?.id !== "string" || !uuidPattern.test(job.id)) {
    throw new Error("CareerOS returned an invalid saved job");
  }
  const text = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim() ? value.slice(0, 500) : undefined;
  const sponsorship = job.sponsorship?.status;
  return {
    jobId: job.id,
    created: (body as { created: boolean }).created,
    title: text(job.title),
    company: text(job.company),
    isCatalog: job.is_catalog === true,
    lastObservedAt: text(job.last_observed_at) ?? null,
    postedAt: text(job.posted_at) ?? null,
    sponsorship:
      sponsorship === "OFFERED" || sponsorship === "NOT_OFFERED"
        ? sponsorship
        : null,
  };
}

/**
 * Saves each explicitly selected answer. The API refuses sensitive questions;
 * those are counted as refused rather than failing the whole batch.
 */
export async function saveReusableAnswers(
  apiUrl: string,
  tokenProvider: TokenProvider,
  request: typeof fetch,
  answers: ReusableAnswerInput[],
): Promise<SavedReusableAnswers | null> {
  const token = await tokenProvider.getToken();
  if (!token) return null;
  const result: SavedReusableAnswers = { saved: 0, refused: 0 };
  for (const answer of answers) {
    const response = await request(`${apiUrl}/reusable-answers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question_text: answer.question,
        answer_text: answer.answer,
      }),
    });
    if (response.status === 401) return null;
    if (response.status === 422) {
      result.refused += 1;
      continue;
    }
    if (!response.ok) {
      throw new Error(`CareerOS could not save answers (${response.status})`);
    }
    result.saved += 1;
  }
  return result;
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

/** Downloads the exact owned file behind one Resume Version. */
export async function downloadResumeVersion(
  apiUrl: string,
  tokenProvider: TokenProvider,
  request: typeof fetch,
  resumeVersionId: string,
): Promise<ResumeFilePayload | null> {
  const token = await tokenProvider.getToken();
  if (!token) return null;
  const response = await request(
    `${apiUrl}/resume-versions/${encodeURIComponent(resumeVersionId)}/file`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`CareerOS could not load the resume (${response.status})`);
  }
  let fileName = "resume";
  try {
    fileName =
      decodeURIComponent(response.headers.get("X-Resume-Filename") ?? "") ||
      fileName;
  } catch {
    // Keep the neutral default for a malformed header.
  }
  return {
    fileName: fileName.slice(0, 500),
    contentType: (
      response.headers.get("Content-Type") ?? "application/octet-stream"
    ).slice(0, 100),
    base64: toBase64(await response.arrayBuffer()),
  };
}

const DRAFT_REFUSALS: Record<
  string,
  "SENSITIVE" | "NO_EVIDENCE" | "NOT_GROUNDED"
> = {
  SENSITIVE_QUESTION: "SENSITIVE",
  NO_CONFIRMED_EVIDENCE: "NO_EVIDENCE",
  DRAFT_NOT_GROUNDED: "NOT_GROUNDED",
};

/** Draft one open-question answer from the user's confirmed evidence. */
export async function draftAnswer(
  apiUrl: string,
  tokenProvider: TokenProvider,
  request: typeof fetch,
  input: DraftAnswerRequestData,
): Promise<DraftedAnswer | null> {
  const token = await tokenProvider.getToken();
  if (!token) return null;
  const response = await request(`${apiUrl}/drafts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      kind: "OPEN_QUESTION",
      question: input.question,
      job_id: input.jobId,
    }),
  });
  return parseDraftResponse(response);
}

/** Maps a POST /drafts response to a draft or an explicit refusal reason. */
export async function parseDraftResponse(
  response: Response,
): Promise<DraftedAnswer | null> {
  if (response.status === 401) return null;
  if (response.status === 503) {
    return { status: "REFUSED", reason: "AI_UNAVAILABLE" };
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code =
      typeof body === "object" &&
      body !== null &&
      typeof (body as { detail?: { code?: unknown } }).detail?.code === "string"
        ? (body as { detail: { code: string } }).detail.code
        : "";
    return { status: "REFUSED", reason: DRAFT_REFUSALS[code] ?? "FAILED" };
  }
  const draft = body as {
    text?: unknown;
    evidence?: unknown;
    unsupported_points?: unknown;
  };
  if (
    typeof draft?.text !== "string" ||
    !Array.isArray(draft.evidence) ||
    !Array.isArray(draft.unsupported_points)
  ) {
    return { status: "REFUSED", reason: "FAILED" };
  }
  return {
    status: "DRAFTED",
    text: draft.text,
    evidenceCount: draft.evidence.length,
    unsupportedPoints: draft.unsupported_points.filter(
      (point): point is string => typeof point === "string",
    ),
  };
}
