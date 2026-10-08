import type {
  Application,
  ApplicationContact,
  ReusableAnswer,
  ApplicationActivity,
  ApplicationStatus,
  ApplicationPacket,
  DraftKind,
  DraftResult,
  InterviewPrep,
  TailoredEdit,
  TailoredVersion,
  TailoringResult,
  ApplicationStatusHistoryBulkEntry,
  HiddenCompany,
  PendingResumeImport,
  RequirementGapsResponse,
  ApplicationStatusHistoryEntry,
  ApplicationSummary,
  CareerBrain,
  ContactInfo,
  CreateApplicationActivityRequest,
  CreateApplicationRequest,
  CreateEducationRequest,
  CreateExperienceRequest,
  CreateJobRequest,
  CreateProjectRequest,
  CreateSkillRequest,
  Education,
  Experience,
  ExperienceDetailResponse,
  Job,
  JobAnalysis,
  JobPreferences,
  JobSearchGoal,
  CreateJobSearchGoalRequest,
  UpdateJobSearchGoalRequest,
  Project,
  ProjectDetailResponse,
  ResumeDraftItem,
  ResumeImport,
  ResumeSummary,
  ResumeVersion,
  Skill,
  UpdateEducationRequest,
  UpdateApplicationActivityRequest,
  UpdateExperienceRequest,
  UpdateProjectRequest,
  UpdateSkillRequest,
} from "./types";

export type HealthResponse = {
  status: "ok";
  database: "connected";
};

export type UserResponse = {
  id: string;
  email: string | null;
  created_at: string;
};

export type ApiErrorCategory =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "rate_limit"
  | "server"
  | "unavailable"
  | "network"
  | "unknown";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly category: ApiErrorCategory,
    public readonly detail?: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function categoryFromStatus(status: number): ApiErrorCategory {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 422) return "validation";
  if (status === 429) return "rate_limit";
  if (status === 503) return "unavailable";
  if (status >= 500 && status <= 599) return "server";
  return "unknown";
}

function formatErrorDetail(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return (raw as Array<{ msg?: string }>)
      .map((entry) => entry.msg ?? JSON.stringify(entry))
      .join("; ");
  }
  return JSON.stringify(raw);
}

async function throwApiError(response: Response): Promise<never> {
  const text = await response.text().catch(() => "");
  let detail: string | undefined;
  let code: string | undefined;
  try {
    const parsed = JSON.parse(text) as {
      detail?: unknown;
      message?: unknown;
    };
    const rawDetail = parsed.detail ?? parsed.message;
    if (
      rawDetail &&
      typeof rawDetail === "object" &&
      !Array.isArray(rawDetail)
    ) {
      const structured = rawDetail as { code?: unknown; message?: unknown };
      code = typeof structured.code === "string" ? structured.code : undefined;
      detail =
        typeof structured.message === "string"
          ? structured.message
          : formatErrorDetail(rawDetail);
    } else {
      detail =
        rawDetail !== undefined
          ? formatErrorDetail(rawDetail)
          : text || undefined;
    }
  } catch {
    detail = text || undefined;
  }
  const category = categoryFromStatus(response.status);
  throw new ApiError(
    detail || `Request failed with status ${response.status}`,
    response.status,
    category,
    detail,
    code,
  );
}

function apiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_URL;

  if (!value) {
    throw new Error("NEXT_PUBLIC_API_URL is required");
  }

  return value.replace(/\/$/, "");
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as T;
}

async function handleEmptyResponse(response: Response): Promise<void> {
  if (!response.ok) {
    await throwApiError(response);
  }
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export async function getSystemHealth(): Promise<HealthResponse> {
  const response = await fetch(`${apiBaseUrl()}/health`, { cache: "no-store" });
  return handleResponse<HealthResponse>(response);
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export async function getCurrentUser(token: string): Promise<UserResponse> {
  const response = await fetch(`${apiBaseUrl()}/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleResponse<UserResponse>(response);
}

// ---------------------------------------------------------------------------
// Career Brain
// ---------------------------------------------------------------------------

export async function getCareerBrain(token: string): Promise<CareerBrain> {
  const response = await fetch(`${apiBaseUrl()}/career-brain`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleResponse<CareerBrain>(response);
}

// ---------------------------------------------------------------------------
// Contact info
// ---------------------------------------------------------------------------

export type { ContactInfo };

export async function getContactInfo(token: string): Promise<ContactInfo> {
  const response = await fetch(`${apiBaseUrl()}/contact-info`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleResponse<ContactInfo>(response);
}

export async function updateContactInfo(
  token: string,
  data: Partial<ContactInfo>,
): Promise<ContactInfo> {
  const response = await fetch(`${apiBaseUrl()}/contact-info`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<ContactInfo>(response);
}

// ---------------------------------------------------------------------------
// Job preferences
// ---------------------------------------------------------------------------

export type { JobPreferences };

export async function getJobPreferences(
  token: string,
): Promise<JobPreferences> {
  const response = await fetch(`${apiBaseUrl()}/job-preferences`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleResponse<JobPreferences>(response);
}

export async function updateJobPreferences(
  token: string,
  data: Partial<JobPreferences>,
): Promise<JobPreferences> {
  const response = await fetch(`${apiBaseUrl()}/job-preferences`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<JobPreferences>(response);
}

export async function listJobSearchGoals(
  token: string,
): Promise<JobSearchGoal[]> {
  const response = await fetch(`${apiBaseUrl()}/job-search-goals`, {
    headers: authHeaders(token),
  });
  return handleResponse<JobSearchGoal[]>(response);
}

export async function createJobSearchGoal(
  token: string,
  data: CreateJobSearchGoalRequest,
): Promise<JobSearchGoal> {
  const response = await fetch(`${apiBaseUrl()}/job-search-goals`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<JobSearchGoal>(response);
}

export async function updateJobSearchGoal(
  token: string,
  goalId: string,
  data: UpdateJobSearchGoalRequest,
): Promise<JobSearchGoal> {
  const response = await fetch(`${apiBaseUrl()}/job-search-goals/${goalId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<JobSearchGoal>(response);
}

export async function listReusableAnswers(
  token: string,
): Promise<ReusableAnswer[]> {
  const response = await fetch(`${apiBaseUrl()}/reusable-answers`, {
    headers: authHeaders(token),
  });
  return handleResponse<ReusableAnswer[]>(response);
}

export async function saveReusableAnswer(
  token: string,
  data: { question_text: string; answer_text: string },
): Promise<ReusableAnswer> {
  const response = await fetch(`${apiBaseUrl()}/reusable-answers`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<ReusableAnswer>(response);
}

export async function revokeReusableAnswer(
  token: string,
  answerId: string,
): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/reusable-answers/${answerId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleEmptyResponse(response);
}

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

export async function createEducation(
  token: string,
  data: CreateEducationRequest,
): Promise<Education> {
  const response = await fetch(`${apiBaseUrl()}/career-brain/educations`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<Education>(response);
}

export async function updateEducation(
  token: string,
  id: string,
  data: UpdateEducationRequest,
): Promise<Education> {
  const response = await fetch(
    `${apiBaseUrl()}/career-brain/educations/${id}`,
    {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  );
  return handleResponse<Education>(response);
}

export async function deleteEducation(
  token: string,
  id: string,
): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl()}/career-brain/educations/${id}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  await handleEmptyResponse(response);
}

// ---------------------------------------------------------------------------
// Resume ingestion and library
// ---------------------------------------------------------------------------

export async function uploadResume(
  token: string,
  file: File,
): Promise<ResumeImport> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${apiBaseUrl()}/resume-imports`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return handleResponse<ResumeImport>(response);
}

export async function getResumeImport(
  token: string,
  importId: string,
): Promise<ResumeImport> {
  const response = await fetch(`${apiBaseUrl()}/resume-imports/${importId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleResponse<ResumeImport>(response);
}

export async function updateResumeDraftItem(
  token: string,
  importId: string,
  itemId: string,
  data: Record<string, unknown>,
): Promise<ResumeDraftItem> {
  const response = await fetch(
    `${apiBaseUrl()}/resume-imports/${importId}/items/${itemId}`,
    {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({ data }),
    },
  );
  return handleResponse<ResumeDraftItem>(response);
}

export async function removeResumeDraftItem(
  token: string,
  importId: string,
  itemId: string,
): Promise<ResumeDraftItem> {
  const response = await fetch(
    `${apiBaseUrl()}/resume-imports/${importId}/items/${itemId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return handleResponse<ResumeDraftItem>(response);
}

export async function confirmResumeImport(
  token: string,
  importId: string,
  contactInfo?: Partial<ContactInfo>,
): Promise<ResumeImport> {
  const response = await fetch(
    `${apiBaseUrl()}/resume-imports/${importId}/confirm`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(
        contactInfo && Object.keys(contactInfo).length > 0
          ? { contact_info: contactInfo }
          : {},
      ),
    },
  );
  return handleResponse<ResumeImport>(response);
}

export async function listResumes(token: string): Promise<ResumeSummary[]> {
  const response = await fetch(`${apiBaseUrl()}/resumes`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleResponse<ResumeSummary[]>(response);
}

export async function getResume(
  token: string,
  resumeId: string,
): Promise<ResumeSummary> {
  const response = await fetch(`${apiBaseUrl()}/resumes/${resumeId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleResponse<ResumeSummary>(response);
}

export async function getResumeVersion(
  token: string,
  resumeId: string,
  versionId: string,
): Promise<ResumeVersion> {
  const response = await fetch(
    `${apiBaseUrl()}/resumes/${resumeId}/versions/${versionId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  return handleResponse<ResumeVersion>(response);
}

// ---------------------------------------------------------------------------
// Jobs and Job Intelligence
// ---------------------------------------------------------------------------

export async function createJob(
  token: string,
  data: CreateJobRequest,
): Promise<Job> {
  const response = await fetch(`${apiBaseUrl()}/jobs`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<Job>(response);
}

export type JobListFilters = {
  search?: string;
  location?: string;
  savedOnly?: boolean;
  market?: string;
  countryCode?: string;
  workplaceType?: string;
  employmentType?: string;
  sort?: "recent" | "title" | "match";
  /** Exact company (case-insensitive). */
  company?: string;
  /** At most two rows per company; rows report their company's total. */
  diversify?: boolean;
  /** "mine" = jobs the user added; "catalog" = shared career-site jobs. */
  source?: "all" | "mine" | "catalog";
  limit?: number;
  offset?: number;
  /** Omit descriptions/requirements; list rows never show them. */
  compact?: boolean;
  /** One row per company+title; the row reports how many others it stands for. */
  collapse?: boolean;
};

export async function listJobs(
  token: string,
  filters: JobListFilters = {},
): Promise<Job[]> {
  const query = new URLSearchParams();
  if (filters.search?.trim()) query.set("search", filters.search.trim());
  if (filters.location?.trim()) query.set("location", filters.location.trim());
  if (filters.savedOnly) query.set("saved_only", "true");
  if (filters.market) query.set("market", filters.market);
  if (filters.countryCode) query.set("country_code", filters.countryCode);
  if (filters.workplaceType) query.set("workplace_type", filters.workplaceType);
  if (filters.employmentType)
    query.set("employment_type", filters.employmentType);
  if (filters.sort && filters.sort !== "recent")
    query.set("sort", filters.sort);
  if (filters.source && filters.source !== "all")
    query.set("source", filters.source);
  if (filters.limit !== undefined) query.set("limit", String(filters.limit));
  if (filters.offset) query.set("offset", String(filters.offset));
  if (filters.compact) query.set("compact", "true");
  if (filters.collapse) query.set("collapse", "true");
  if (filters.company?.trim()) query.set("company", filters.company.trim());
  if (filters.diversify) query.set("diversify", "true");
  const suffix = query.size ? `?${query.toString()}` : "";
  const response = await fetch(`${apiBaseUrl()}/jobs${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleResponse<Job[]>(response);
}

export async function getJob(token: string, jobId: string): Promise<Job> {
  const response = await fetch(`${apiBaseUrl()}/jobs/${jobId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleResponse<Job>(response);
}

export async function saveJob(token: string, jobId: string): Promise<Job> {
  const response = await fetch(`${apiBaseUrl()}/jobs/${jobId}/save`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<Job>(response);
}

export async function updateJob(
  token: string,
  jobId: string,
  data: Partial<
    Pick<
      Job,
      | "company"
      | "title"
      | "location"
      | "application_url"
      | "market"
      | "country_code"
      | "workplace_type"
      | "employment_type"
    >
  >,
): Promise<Job> {
  const response = await fetch(`${apiBaseUrl()}/jobs/${jobId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<Job>(response);
}

/** Extracts requirements for a job whose latest snapshot is still pending. */
export async function extractJobRequirements(
  token: string,
  jobId: string,
): Promise<Job> {
  const response = await fetch(`${apiBaseUrl()}/jobs/${jobId}/requirements`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<Job>(response);
}

export async function deleteJob(token: string, jobId: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/jobs/${jobId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleEmptyResponse(response);
}

export async function deleteApplication(
  token: string,
  applicationId: string,
): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl()}/applications/${applicationId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  await handleEmptyResponse(response);
}

export async function deleteResume(
  token: string,
  resumeId: string,
): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/resumes/${resumeId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleEmptyResponse(response);
}

export async function listApplicationContacts(
  token: string,
  applicationId: string,
): Promise<ApplicationContact[]> {
  const response = await fetch(
    `${apiBaseUrl()}/applications/${applicationId}/contacts`,
    { headers: authHeaders(token) },
  );
  return handleResponse<ApplicationContact[]>(response);
}

export async function createApplicationContact(
  token: string,
  applicationId: string,
  data: Pick<
    ApplicationContact,
    "name" | "relationship_type" | "email" | "profile_url" | "notes"
  >,
): Promise<ApplicationContact> {
  const response = await fetch(
    `${apiBaseUrl()}/applications/${applicationId}/contacts`,
    { method: "POST", headers: authHeaders(token), body: JSON.stringify(data) },
  );
  return handleResponse<ApplicationContact>(response);
}

export async function deleteApplicationContact(
  token: string,
  applicationId: string,
  contactId: string,
): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl()}/applications/${applicationId}/contacts/${contactId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
  );
  await handleEmptyResponse(response);
}

/** Open follow-ups and interviews as an iCalendar file. */
export async function downloadActivityCalendar(token: string): Promise<Blob> {
  const response = await fetch(`${apiBaseUrl()}/calendar/activities.ics`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) await handleEmptyResponse(response);
  return response.blob();
}

/** Downloads every record the user owns as one JSON blob. */
export async function exportAccountData(token: string): Promise<Blob> {
  const response = await fetch(`${apiBaseUrl()}/me/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) await handleEmptyResponse(response);
  return response.blob();
}

export async function deleteAccount(token: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/me`, {
    method: "DELETE",
    headers: authHeaders(token),
    body: JSON.stringify({ confirm: "DELETE" }),
  });
  await handleEmptyResponse(response);
}

export async function unsaveJob(token: string, jobId: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/jobs/${jobId}/save`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleEmptyResponse(response);
}

export async function createJobAnalysis(
  token: string,
  jobId: string,
  resumeVersionId: string,
): Promise<JobAnalysis> {
  const response = await fetch(`${apiBaseUrl()}/jobs/${jobId}/analyses`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ resume_version_id: resumeVersionId }),
  });
  return handleResponse<JobAnalysis>(response);
}

export async function listJobAnalyses(
  token: string,
  jobId: string,
): Promise<JobAnalysis[]> {
  const response = await fetch(`${apiBaseUrl()}/jobs/${jobId}/analyses`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleResponse<JobAnalysis[]>(response);
}

// ---------------------------------------------------------------------------
// Application Memory
// ---------------------------------------------------------------------------

export async function createApplication(
  token: string,
  data: CreateApplicationRequest,
): Promise<Application> {
  const response = await fetch(`${apiBaseUrl()}/applications`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<Application>(response);
}

export async function listApplications(
  token: string,
  status?: ApplicationStatus,
): Promise<ApplicationSummary[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await fetch(`${apiBaseUrl()}/applications${query}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleResponse<ApplicationSummary[]>(response);
}

export async function getApplication(
  token: string,
  applicationId: string,
): Promise<Application> {
  const response = await fetch(
    `${apiBaseUrl()}/applications/${applicationId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  return handleResponse<Application>(response);
}

export async function getApplicationStatusHistory(
  token: string,
  applicationId: string,
): Promise<ApplicationStatusHistoryEntry[]> {
  const response = await fetch(
    `${apiBaseUrl()}/applications/${applicationId}/status-history`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  return handleResponse<ApplicationStatusHistoryEntry[]>(response);
}

/** Every status transition across the caller's applications, oldest first. */
export async function listApplicationStatusHistory(
  token: string,
): Promise<ApplicationStatusHistoryBulkEntry[]> {
  const response = await fetch(`${apiBaseUrl()}/applications/status-history`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleResponse<ApplicationStatusHistoryBulkEntry[]>(response);
}

export async function listApplicationActivities(
  token: string,
  applicationId: string,
): Promise<ApplicationActivity[]> {
  const response = await fetch(
    `${apiBaseUrl()}/applications/${applicationId}/activities`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  return handleResponse<ApplicationActivity[]>(response);
}

export async function listUpcomingApplicationActivities(
  token: string,
  limit = 20,
): Promise<ApplicationActivity[]> {
  const response = await fetch(
    `${apiBaseUrl()}/applications/activities/upcoming?limit=${limit}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  return handleResponse<ApplicationActivity[]>(response);
}

export async function createApplicationActivity(
  token: string,
  applicationId: string,
  data: CreateApplicationActivityRequest,
): Promise<ApplicationActivity> {
  const response = await fetch(
    `${apiBaseUrl()}/applications/${applicationId}/activities`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  );
  return handleResponse<ApplicationActivity>(response);
}

export async function updateApplicationActivity(
  token: string,
  applicationId: string,
  activityId: string,
  data: UpdateApplicationActivityRequest,
): Promise<ApplicationActivity> {
  const response = await fetch(
    `${apiBaseUrl()}/applications/${applicationId}/activities/${activityId}`,
    {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  );
  return handleResponse<ApplicationActivity>(response);
}

export async function updateApplicationStatus(
  token: string,
  applicationId: string,
  status: ApplicationStatus,
  idempotencyKey: string,
): Promise<Application> {
  const response = await fetch(
    `${apiBaseUrl()}/applications/${applicationId}/status`,
    {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        status,
      }),
    },
  );
  return handleResponse<Application>(response);
}

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

export async function createExperience(
  token: string,
  data: CreateExperienceRequest,
): Promise<Experience> {
  const response = await fetch(`${apiBaseUrl()}/career-brain/experiences`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<Experience>(response);
}

export async function updateExperience(
  token: string,
  id: string,
  data: UpdateExperienceRequest,
): Promise<Experience> {
  const response = await fetch(
    `${apiBaseUrl()}/career-brain/experiences/${id}`,
    {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  );
  return handleResponse<Experience>(response);
}

export async function deleteExperience(
  token: string,
  id: string,
): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl()}/career-brain/experiences/${id}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  await handleEmptyResponse(response);
}

// ---------------------------------------------------------------------------
// Experience Details
// ---------------------------------------------------------------------------

export async function createExperienceDetail(
  token: string,
  experienceId: string,
  data: { content: string },
): Promise<ExperienceDetailResponse> {
  const response = await fetch(
    `${apiBaseUrl()}/career-brain/experiences/${experienceId}/details`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  );
  return handleResponse<ExperienceDetailResponse>(response);
}

export async function updateExperienceDetail(
  token: string,
  detailId: string,
  data: { content: string },
): Promise<ExperienceDetailResponse> {
  const response = await fetch(
    `${apiBaseUrl()}/career-brain/experience-details/${detailId}`,
    {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  );
  return handleResponse<ExperienceDetailResponse>(response);
}

export async function deleteExperienceDetail(
  token: string,
  detailId: string,
): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl()}/career-brain/experience-details/${detailId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  await handleEmptyResponse(response);
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export async function createProject(
  token: string,
  data: CreateProjectRequest,
): Promise<Project> {
  const response = await fetch(`${apiBaseUrl()}/career-brain/projects`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<Project>(response);
}

export async function updateProject(
  token: string,
  id: string,
  data: UpdateProjectRequest,
): Promise<Project> {
  const response = await fetch(`${apiBaseUrl()}/career-brain/projects/${id}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<Project>(response);
}

export async function deleteProject(token: string, id: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/career-brain/projects/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleEmptyResponse(response);
}

// ---------------------------------------------------------------------------
// Project Details
// ---------------------------------------------------------------------------

export async function createProjectDetail(
  token: string,
  projectId: string,
  data: { content: string },
): Promise<ProjectDetailResponse> {
  const response = await fetch(
    `${apiBaseUrl()}/career-brain/projects/${projectId}/details`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  );
  return handleResponse<ProjectDetailResponse>(response);
}

export async function updateProjectDetail(
  token: string,
  detailId: string,
  data: { content: string },
): Promise<ProjectDetailResponse> {
  const response = await fetch(
    `${apiBaseUrl()}/career-brain/project-details/${detailId}`,
    {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  );
  return handleResponse<ProjectDetailResponse>(response);
}

export async function deleteProjectDetail(
  token: string,
  detailId: string,
): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl()}/career-brain/project-details/${detailId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  await handleEmptyResponse(response);
}

// ---------------------------------------------------------------------------
// Skill
// ---------------------------------------------------------------------------

export async function createSkill(
  token: string,
  data: CreateSkillRequest,
): Promise<Skill> {
  const response = await fetch(`${apiBaseUrl()}/career-brain/skills`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<Skill>(response);
}

export async function updateSkill(
  token: string,
  id: string,
  data: UpdateSkillRequest,
): Promise<Skill> {
  const response = await fetch(`${apiBaseUrl()}/career-brain/skills/${id}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<Skill>(response);
}

export async function deleteSkill(token: string, id: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/career-brain/skills/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleEmptyResponse(response);
}

export async function getRequirementGaps(
  token: string,
): Promise<RequirementGapsResponse> {
  const response = await fetch(`${apiBaseUrl()}/insights/requirement-gaps`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleResponse<RequirementGapsResponse>(response);
}

export async function listPendingResumeImports(
  token: string,
): Promise<PendingResumeImport[]> {
  const response = await fetch(
    `${apiBaseUrl()}/insights/pending-resume-imports`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  return handleResponse<PendingResumeImport[]>(response);
}

export async function dismissJob(token: string, jobId: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/jobs/${jobId}/dismiss`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleEmptyResponse(response);
}

export async function undismissJob(
  token: string,
  jobId: string,
): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/jobs/${jobId}/dismiss`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleEmptyResponse(response);
}

export async function listHiddenCompanies(
  token: string,
): Promise<HiddenCompany[]> {
  const response = await fetch(`${apiBaseUrl()}/hidden-companies`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleResponse<HiddenCompany[]>(response);
}

export async function hideCompany(
  token: string,
  company: string,
): Promise<HiddenCompany> {
  const response = await fetch(`${apiBaseUrl()}/hidden-companies`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ company }),
  });
  return handleResponse<HiddenCompany>(response);
}

export async function unhideCompany(
  token: string,
  hiddenId: string,
): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/hidden-companies/${hiddenId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleEmptyResponse(response);
}

export async function getApplicationPacket(
  token: string,
  applicationId: string,
): Promise<ApplicationPacket> {
  const response = await fetch(
    `${apiBaseUrl()}/applications/${applicationId}/packet`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  return handleResponse<ApplicationPacket>(response);
}

export async function suggestTailoring(
  token: string,
  jobId: string,
  resumeVersionId: string,
): Promise<TailoringResult> {
  const response = await fetch(`${apiBaseUrl()}/jobs/${jobId}/tailoring`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ resume_version_id: resumeVersionId }),
  });
  return handleResponse<TailoringResult>(response);
}

export async function createTailoredVersion(
  token: string,
  data: {
    base_resume_version_id: string;
    job_id: string;
    edits: TailoredEdit[];
  },
): Promise<TailoredVersion> {
  const response = await fetch(`${apiBaseUrl()}/resumes/tailored`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<TailoredVersion>(response);
}

export async function createDraft(
  token: string,
  data: { kind: DraftKind; job_id?: string | null; question?: string | null },
): Promise<DraftResult> {
  const response = await fetch(`${apiBaseUrl()}/drafts`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<DraftResult>(response);
}

export async function getInterviewPrep(
  token: string,
  jobId: string,
): Promise<InterviewPrep> {
  const response = await fetch(`${apiBaseUrl()}/jobs/${jobId}/interview-prep`, {
    method: "POST",
    headers: authHeaders(token),
  });
  return handleResponse<InterviewPrep>(response);
}
