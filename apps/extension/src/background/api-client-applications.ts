import type {
  ApplicationPageContext,
  PrepareApplicationRequestData,
  RecordApplicationRequestData,
  ResumeVersionOption,
  TrackedApplication,
} from "../shared/messages";

interface TokenProvider {
  getToken(): Promise<string | null>;
}

export async function getApplicationContext(
  apiUrl: string,
  tokenProvider: TokenProvider,
  request: typeof fetch,
  pageUrl: string,
  pageTitle: string,
): Promise<ApplicationPageContext | null> {
  const token = await tokenProvider.getToken();
  if (!token) return null;
  const response = await request(`${apiUrl}/applications/assistant-context`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ application_url: pageUrl }),
  });
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error("CareerOS application context is unavailable");
  }
  const assistantContext = parseAssistantContext(await response.json());
  if (!assistantContext) {
    throw new Error("CareerOS returned invalid application context");
  }
  return {
    pageUrl,
    pageTitle: pageTitle.slice(0, 500),
    siteHost: new URL(pageUrl).hostname.slice(0, 100),
    ...assistantContext,
  };
}

export async function recordApplication(
  apiUrl: string,
  tokenProvider: TokenProvider,
  request: typeof fetch,
  input: RecordApplicationRequestData,
  pageUrl: string,
): Promise<TrackedApplication | null> {
  const token = await tokenProvider.getToken();
  if (!token) return null;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const answers = input.answers.map((answer) => ({
    canonical_key: answer.canonicalKey,
    question_text: answer.questionText,
    answer_text: answer.answerText,
    source_category: answer.sourceCategory,
    policy_category: "STANDARD",
    sensitivity: "NONE",
    user_confirmed: true,
  }));
  const response = input.applicationId
    ? await request(
        `${apiUrl}/applications/${input.applicationId}/submission`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            idempotency_key: input.idempotencyKey,
            resume_version_id: input.resumeVersionId,
            answers,
          }),
        },
      )
    : await request(`${apiUrl}/applications`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          idempotency_key: input.idempotencyKey,
          origin: "EXTERNAL_PAGE",
          company: input.company.trim(),
          role: input.role.trim(),
          application_url: pageUrl,
          source: new URL(pageUrl).hostname.slice(0, 100),
          resume_version_id: input.resumeVersionId,
          status: "APPLIED",
          answers,
        }),
      });
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`CareerOS API returned ${response.status}`);
  }
  const application = parseApplication(await response.json());
  if (!application) throw new Error("CareerOS returned an invalid Application");
  return application;
}

export async function prepareApplication(
  apiUrl: string,
  tokenProvider: TokenProvider,
  request: typeof fetch,
  input: PrepareApplicationRequestData,
  pageUrl: string,
): Promise<TrackedApplication | null> {
  const token = await tokenProvider.getToken();
  if (!token) return null;
  const response = await request(`${apiUrl}/applications`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      idempotency_key: input.idempotencyKey,
      origin: "EXTERNAL_PAGE",
      company: input.company.trim(),
      role: input.role.trim(),
      application_url: pageUrl,
      source: new URL(pageUrl).hostname.slice(0, 100),
      resume_version_id: input.resumeVersionId,
      status: "PREPARING",
      answers: [],
    }),
  });
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`CareerOS API returned ${response.status}`);
  }
  const application = parseApplication(await response.json());
  if (!application) {
    throw new Error("CareerOS returned an invalid Application");
  }
  return application;
}

const applicationStatuses = [
  "PREPARING",
  "APPLIED",
  "ASSESSMENT",
  "INTERVIEW",
  "FINAL",
  "REJECTED",
  "OFFER",
  "WITHDRAWN",
] as const;
const applicationOrigins = ["CAREEROS_JOB", "EXTERNAL_PAGE", "MANUAL"] as const;
const applicationMarkets = ["UNKNOWN", "NORTH_AMERICA", "CHINA"] as const;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : null;
}

function parseApplication(value: unknown): TrackedApplication | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !uuidPattern.test(value.id) ||
    typeof value.company !== "string" ||
    value.company.length === 0 ||
    value.company.length > 500 ||
    typeof value.role !== "string" ||
    value.role.length === 0 ||
    value.role.length > 500 ||
    !(
      value.application_url === null ||
      typeof value.application_url === "string"
    ) ||
    !(
      value.resume_version_id === null ||
      (typeof value.resume_version_id === "string" &&
        uuidPattern.test(value.resume_version_id))
    ) ||
    !enumValue(value.status, applicationStatuses) ||
    !enumValue(value.origin, applicationOrigins) ||
    !(
      value.market === undefined || enumValue(value.market, applicationMarkets)
    ) ||
    typeof value.created_at !== "string"
  ) {
    return null;
  }
  return {
    id: value.id,
    company: value.company,
    role: value.role,
    applicationUrl: value.application_url,
    resumeVersionId: value.resume_version_id,
    status: enumValue(value.status, applicationStatuses)!,
    origin: enumValue(value.origin, applicationOrigins)!,
    market: enumValue(value.market, applicationMarkets) ?? "UNKNOWN",
    createdAt: value.created_at,
  };
}

function parseResumeOptions(value: unknown): ResumeVersionOption[] | null {
  if (!Array.isArray(value) || value.length > 10_000) return null;
  const options: ResumeVersionOption[] = [];
  for (const version of value) {
    if (
      !isRecord(version) ||
      !hasExactKeys(version, ["id", "label"]) ||
      typeof version.id !== "string" ||
      !uuidPattern.test(version.id) ||
      typeof version.label !== "string" ||
      version.label.length === 0 ||
      version.label.length > 1_000
    ) {
      return null;
    }
    options.push({ id: version.id, label: version.label });
  }
  return options;
}

function parseAssistantContext(
  value: unknown,
): Pick<
  ApplicationPageContext,
  "matchKind" | "application" | "resumeVersions"
> | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["match_kind", "application", "resume_versions"]) ||
    !["EXACT_URL", "RECENT_PREPARING", "NONE"].includes(
      value.match_kind as string,
    )
  ) {
    return null;
  }
  const application =
    value.application === null ? null : parseApplication(value.application);
  const resumeVersions = parseResumeOptions(value.resume_versions);
  if (
    (value.application !== null && application === null) ||
    resumeVersions === null ||
    (value.match_kind === "NONE" && application !== null) ||
    (value.match_kind !== "NONE" && application === null)
  ) {
    return null;
  }
  return {
    matchKind: value.match_kind as ApplicationPageContext["matchKind"],
    application,
    resumeVersions,
  };
}
