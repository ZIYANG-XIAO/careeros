import type {
  ClipJobRequestData,
  ClippedJob,
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
  const job = (body as { job?: { id?: unknown } }).job;
  if (typeof job?.id !== "string" || !uuidPattern.test(job.id)) {
    throw new Error("CareerOS returned an invalid saved job");
  }
  return { jobId: job.id, created: (body as { created: boolean }).created };
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
