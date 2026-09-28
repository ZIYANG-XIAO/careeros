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
  preferred: boolean;
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

export type ContactInfo = {
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  given_name_native: string | null;
  family_name_native: string | null;
  full_name_native: string | null;
  contact_email: string | null;
  phone: string | null;
  wechat_id: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  district: string | null;
  region: string | null;
  postal_code: string | null;
  country_code: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  confirmed_at: string | null;
};

export type ContactInfoField = Exclude<keyof ContactInfo, "confirmed_at">;

export type JobPreferences = {
  target_roles: string[];
  cities: string[];
  company_sizes: string[];
  industries_include: string[];
  industries_exclude: string[];
  company_blocklist: string[];
  minimum_salary: number | null;
  security_clearance_interest: boolean;
};

export type JobSearchGoalMarket = "UNKNOWN" | "NORTH_AMERICA" | "CHINA";

export type JobSearchGoal = {
  id: string;
  name: string;
  market: JobSearchGoalMarket;
  country_codes: string[];
  target_roles: string[];
  cities: string[];
  workplace_types: Array<"ONSITE" | "HYBRID" | "REMOTE">;
  employment_types: Array<
    "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP"
  >;
  company_sizes: string[];
  industries_include: string[];
  industries_exclude: string[];
  company_blocklist: string[];
  minimum_salary: number | null;
  salary_currency: string | null;
  default_resume_id: string | null;
  security_clearance_interest: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateJobSearchGoalRequest = Omit<
  JobSearchGoal,
  "id" | "created_at" | "updated_at"
>;

export type UpdateJobSearchGoalRequest = Partial<CreateJobSearchGoalRequest>;

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
  preferred: boolean;
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
  preferred?: boolean;
};

export type UpdateSkillRequest = {
  name: string;
  preferred?: boolean;
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
  contact_info_candidate: Partial<Record<ContactInfoField, string>>;
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
  source_key: string;
  external_job_id: string | null;
  canonical_url: string | null;
  first_observed_at: string | null;
  last_observed_at: string | null;
  availability_status: "UNKNOWN" | "AVAILABLE" | "UNAVAILABLE";
  freshness_status: "UNKNOWN" | "CURRENT" | "STALE";
  market: JobMarket;
  country_code: JobCountry;
  workplace_type: JobWorkplaceType;
  employment_type: JobEmploymentType;
  captured_at: string;
  created_at: string;
  updated_at: string;
  is_saved: boolean;
  saved_at: string | null;
  latest_snapshot: JobSnapshot;
};

export type JobMarket = "UNKNOWN" | "NORTH_AMERICA" | "CHINA";
export type JobCountry = "UNKNOWN" | "US" | "CA" | "CN";
export type JobWorkplaceType = "UNKNOWN" | "REMOTE" | "HYBRID" | "ONSITE";
export type JobEmploymentType =
  "UNKNOWN" | "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";

export type CreateJobRequest = {
  company: string;
  title: string;
  location?: string | null;
  description: string;
  source_url?: string | null;
  application_url?: string | null;
  market?: JobMarket;
  country_code?: JobCountry;
  workplace_type?: JobWorkplaceType;
  employment_type?: JobEmploymentType;
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

// ---------------------------------------------------------------------------
// Durable Application Memory.
// ---------------------------------------------------------------------------

export type ApplicationStatus =
  | "PREPARING"
  | "APPLIED"
  | "ASSESSMENT"
  | "INTERVIEW"
  | "FINAL"
  | "REJECTED"
  | "OFFER"
  | "WITHDRAWN";

export type ApplicationOrigin = "CAREEROS_JOB" | "EXTERNAL_PAGE" | "MANUAL";

export type ApplicationAnswer = {
  id: string;
  canonical_key: string | null;
  question_text: string;
  answer_text: string;
  source_category: string;
  policy_category: "STANDARD";
  sensitivity: "NONE";
  position: number;
  confirmed_at: string;
  created_at: string;
};

export type ApplicationSummary = {
  id: string;
  job_id: string | null;
  resume_version_id: string | null;
  origin: ApplicationOrigin;
  company: string;
  role: string;
  application_url: string | null;
  source: string;
  status: ApplicationStatus;
  applied_at: string | null;
  status_updated_at: string;
  created_at: string;
  updated_at: string;
};

export type Application = ApplicationSummary & {
  answers: ApplicationAnswer[];
};

export type ApplicationStatusHistoryEntry = {
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  changed_at: string;
};

export type ApplicationActivityType = "NOTE" | "FOLLOW_UP" | "INTERVIEW";

export type ApplicationActivity = {
  id: string;
  application_id: string;
  activity_type: ApplicationActivityType;
  title: string;
  body: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateApplicationActivityRequest = {
  idempotency_key: string;
  activity_type: ApplicationActivityType;
  title: string;
  body?: string | null;
  scheduled_at?: string | null;
};

export type UpdateApplicationActivityRequest = {
  title?: string;
  body?: string | null;
  scheduled_at?: string;
  completed?: boolean;
};

export type CreateApplicationRequest = {
  idempotency_key: string;
  origin: ApplicationOrigin;
  job_id?: string | null;
  company?: string | null;
  role?: string | null;
  application_url?: string | null;
  source?: string | null;
  resume_version_id?: string | null;
  status?: ApplicationStatus;
  applied_at?: string | null;
  answers?: Array<{
    canonical_key?: string | null;
    question_text: string;
    answer_text: string;
    source_category:
      | "IDENTITY"
      | "CAREER_BRAIN"
      | "USER_CONTACT_INFO"
      | "RESUME_VERSION"
      | "USER_PROVIDED";
    policy_category: "STANDARD";
    sensitivity: "NONE";
    user_confirmed: true;
  }>;
};
