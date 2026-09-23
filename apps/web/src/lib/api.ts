import type {
  CareerBrain,
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
    const text = await response.text().catch(() => "");
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export async function getSystemHealth(): Promise<HealthResponse> {
  const response = await fetch(`${apiBaseUrl()}/health`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("CareerOS API health check failed");
  }

  return (await response.json()) as HealthResponse;
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export async function getCurrentUser(token: string): Promise<UserResponse> {
  const response = await fetch(`${apiBaseUrl()}/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch current user");
  }

  return (await response.json()) as UserResponse;
}

// ---------------------------------------------------------------------------
// Career Brain
// ---------------------------------------------------------------------------

export async function getCareerBrain(token: string): Promise<CareerBrain> {
  const response = await fetch(`${apiBaseUrl()}/career-brain`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch career brain");
  }

  return (await response.json()) as CareerBrain;
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
  if (!response.ok) {
    throw new Error("Failed to delete education");
  }
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
};

export async function listJobs(
  token: string,
  filters: JobListFilters = {},
): Promise<Job[]> {
  const query = new URLSearchParams();
  if (filters.search?.trim()) query.set("search", filters.search.trim());
  if (filters.location?.trim()) query.set("location", filters.location.trim());
  if (filters.savedOnly) query.set("saved_only", "true");
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
  if (!response.ok) {
    throw new Error("Failed to remove saved job");
  }
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
  if (!response.ok) {
    throw new Error("Failed to delete experience");
  }
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
  if (!response.ok) {
    throw new Error("Failed to delete experience detail");
  }
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
  if (!response.ok) {
    throw new Error("Failed to delete project");
  }
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
  if (!response.ok) {
    throw new Error("Failed to delete project detail");
  }
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
  if (!response.ok) {
    throw new Error("Failed to delete skill");
  }
}
