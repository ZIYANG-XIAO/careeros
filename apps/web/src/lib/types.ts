// ---------------------------------------------------------------------------
// GET /career-brain aggregate summary types.
// These match the CareerBrainResponse schema from career_brain.py exactly.
// Evidence fields are present in the API response but not surfaced in the UI.
// ---------------------------------------------------------------------------

export type DetailEvidence = {
  evidence_id: string;
  current_revision_id: string | null;
  current_revision_number: number | null;
  confirmation_status: string | null;
};

export type EducationSummary = {
  id: string;
  institution: string;
  degree: string | null;
  field_of_study: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
};

export type DetailSummary = {
  id: string;
  content: string;
  evidence: DetailEvidence | null;
};

export type ExperienceSummary = {
  id: string;
  company: string;
  title: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  details: DetailSummary[];
};

export type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  url: string | null;
  start_date: string | null;
  end_date: string | null;
  details: DetailSummary[];
};

export type SkillSummary = {
  id: string;
  name: string;
  evidence: DetailEvidence | null;
};

export type CareerBrain = {
  id: string;
  created_at: string;
  educations: EducationSummary[];
  experiences: ExperienceSummary[];
  projects: ProjectSummary[];
  skills: SkillSummary[];
};

// ---------------------------------------------------------------------------
// CRUD endpoint response types (full entity shapes with timestamps).
// ---------------------------------------------------------------------------

export type Education = {
  id: string;
  institution: string;
  degree: string | null;
  field_of_study: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

export type ExperienceDetailResponse = {
  id: string;
  experience_id: string;
  content: string;
  evidence: DetailEvidence | null;
  created_at: string;
  updated_at: string;
};

export type Experience = {
  id: string;
  company: string;
  title: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  details: ExperienceDetailResponse[];
  created_at: string;
  updated_at: string;
};

export type ProjectDetailResponse = {
  id: string;
  project_id: string;
  content: string;
  evidence: DetailEvidence | null;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  name: string;
  description: string | null;
  url: string | null;
  start_date: string | null;
  end_date: string | null;
  details: ProjectDetailResponse[];
  created_at: string;
  updated_at: string;
};

export type Skill = {
  id: string;
  name: string;
  evidence: DetailEvidence | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Request types for mutations.
// ---------------------------------------------------------------------------

export type CreateEducationRequest = {
  institution: string;
  degree?: string | null;
  field_of_study?: string | null;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

export type UpdateEducationRequest = {
  institution?: string;
  degree?: string | null;
  field_of_study?: string | null;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

export type CreateExperienceRequest = {
  company: string;
  title: string;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean;
};

export type UpdateExperienceRequest = {
  company?: string;
  title?: string;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean;
};

export type CreateProjectRequest = {
  name: string;
  description?: string | null;
  url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

export type UpdateProjectRequest = {
  name?: string;
  description?: string | null;
  url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

export type CreateSkillRequest = {
  name: string;
};

export type UpdateSkillRequest = {
  name: string;
};

// ---------------------------------------------------------------------------
// Resume ingestion and library.
// ---------------------------------------------------------------------------

export type ResumeDraftItem = {
  id: string;
  parent_item_id: string | null;
  item_type:
    | "EDUCATION"
    | "EXPERIENCE"
    | "EXPERIENCE_DETAIL"
    | "PROJECT"
    | "PROJECT_DETAIL"
    | "SKILL";
  data: Record<string, unknown>;
  position: number;
  status: "ACTIVE" | "REMOVED" | "CONFIRMED";
  materialized_source_type: string | null;
  materialized_source_id: string | null;
};

export type ResumeImport = {
  id: string;
  resume_id: string;
  resume_name: string;
  resume_version_id: string;
  version_number: number;
  status: "PROCESSING" | "READY_FOR_REVIEW" | "CONFIRMED" | "FAILED";
  error_code: string | null;
  error_message: string | null;
  items: ResumeDraftItem[];
  created_at: string;
  confirmed_at: string | null;
};

export type ResumeVersion = {
  id: string;
  version_number: number;
  source: string;
  created_by: string;
  source_version_id: string | null;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  parser_version: string;
  extracted_text: string;
  structured_content: Record<string, unknown>;
  created_at: string;
};

export type ResumeSummary = {
  id: string;
  name: string;
  type: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  versions: ResumeVersion[];
};

// ---------------------------------------------------------------------------
// Jobs and reproducible Job Intelligence.
// ---------------------------------------------------------------------------

export type JobRequirement = {
  id: string;
  category: string;
  description: string;
  normalized_value: string | null;
  importance: string;
  source_text: string;
  confidence: string;
  position: number;
};

export type JobSnapshot = {
  id: string;
  version_number: number;
  raw_description: string;
  normalized_description: string;
  content_sha256: string;
  parser_version: string;
  parser_model: string;
  created_at: string;
  requirements: JobRequirement[];
};

export type Job = {
  id: string;
  company: string;
  title: string;
  location: string | null;
  source_url: string | null;
  application_url: string | null;
  source_type: string;
  captured_at: string;
  created_at: string;
  updated_at: string;
  latest_snapshot: JobSnapshot;
};

export type CreateJobRequest = {
  company: string;
  title: string;
  location?: string | null;
  description: string;
  source_url?: string | null;
};

export type EvidenceReference = {
  career_evidence_id: string;
  career_evidence_revision_id: string;
  source_type: string;
  source_id: string;
  evidence_content: string;
  revision_number: number;
};

export type RequirementAnalysis = {
  id: string;
  requirement_id: string;
  category: string;
  description: string;
  normalized_value: string | null;
  importance: string;
  source_text: string;
  support_strength: "STRONG" | "WEAK" | "NONE_OR_INSUFFICIENT";
  resume_representation: "REPRESENTED" | "UNDERREPRESENTED" | "ABSENT";
  classification:
    "STRONG_EVIDENCE" | "HIDDEN_EVIDENCE" | "WEAK_EVIDENCE" | "GENUINE_GAP";
  explanation: string;
  resume_source_text: string | null;
  evidence_references: EvidenceReference[];
};

export type JobAnalysis = {
  id: string;
  job_id: string;
  job_snapshot_id: string;
  company: string;
  title: string;
  resume_version_id: string;
  resume_name: string;
  resume_version_number: number;
  analysis_version: number;
  matcher_version: string;
  matcher_model: string;
  overall_recommendation: "STRONG_APPLY" | "APPLY" | "STRETCH" | "LOW_PRIORITY";
  summary: string;
  created_at: string;
  matches: RequirementAnalysis[];
};
