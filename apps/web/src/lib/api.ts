import type {
  Application,
  ApplicationStatus,
  ApplicationSummary,
  CareerBrain,
  ContactInfo,
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
  Project,
  ProjectDetailResponse,
  ResumeDraftItem,
  ResumeImport,
  ResumeSummary,
  ResumeVersion,
  Skill,
  UpdateEducationRequest,
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
  try {
    const parsed = JSON.parse(text) as {
      detail?: unknown;
      message?: unknown;
    };
    const rawDetail = parsed.detail ?? parsed.message;
    detail =
      rawDetail !== undefined
        ? formatErrorDetail(rawDetail)
        : text || undefined;
  } catch {
    detail = text || undefined;
  }
  const category = categoryFromStatus(response.status);
  throw new ApiError(
    detail || `Request failed with status ${response.status}`,
    response.status,
    category,
    detail,
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
): Promise<ResumeImport> {
  const response = await fetch(
    `${apiBaseUrl()}/resume-imports/${importId}/confirm`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
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
  sort?: "recent" | "title";
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
