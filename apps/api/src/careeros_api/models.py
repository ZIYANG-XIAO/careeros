import enum
from datetime import datetime
from uuid import UUID, uuid4

import sqlalchemy as sa
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class SourceType(enum.StrEnum):
    RESUME_DRAFT_ITEM = "RESUME_DRAFT_ITEM"
    EDUCATION = "EDUCATION"
    EXPERIENCE = "EXPERIENCE"
    EXPERIENCE_DETAIL = "EXPERIENCE_DETAIL"
    PROJECT = "PROJECT"
    PROJECT_DETAIL = "PROJECT_DETAIL"
    SKILL = "SKILL"


class EvidenceOrigin(enum.StrEnum):
    USER_ENTERED = "USER_ENTERED"
    RESUME_IMPORT = "RESUME_IMPORT"
    SYSTEM_EXTRACTED = "SYSTEM_EXTRACTED"
    AI_SUGGESTED = "AI_SUGGESTED"


class ConfirmationStatus(enum.StrEnum):
    UNCONFIRMED = "UNCONFIRMED"
    CONFIRMED = "CONFIRMED"


class CreatedBy(enum.StrEnum):
    USER = "USER"
    SYSTEM = "SYSTEM"
    AI = "AI"


class ResumeImportStatus(enum.StrEnum):
    PROCESSING = "PROCESSING"
    READY_FOR_REVIEW = "READY_FOR_REVIEW"
    CONFIRMED = "CONFIRMED"
    FAILED = "FAILED"


class ResumeDraftItemType(enum.StrEnum):
    EDUCATION = "EDUCATION"
    EXPERIENCE = "EXPERIENCE"
    EXPERIENCE_DETAIL = "EXPERIENCE_DETAIL"
    PROJECT = "PROJECT"
    PROJECT_DETAIL = "PROJECT_DETAIL"
    SKILL = "SKILL"


class ResumeDraftItemStatus(enum.StrEnum):
    ACTIVE = "ACTIVE"
    REMOVED = "REMOVED"
    CONFIRMED = "CONFIRMED"


class ResumeVersionSource(enum.StrEnum):
    UPLOADED = "UPLOADED"


class ResumeType(enum.StrEnum):
    BASE = "BASE"


class JobSourceType(enum.StrEnum):
    MANUAL_ENTRY = "MANUAL_ENTRY"


class JobRequirementCategory(enum.StrEnum):
    SKILL = "SKILL"
    EXPERIENCE = "EXPERIENCE"
    RESPONSIBILITY = "RESPONSIBILITY"
    EDUCATION = "EDUCATION"
    DOMAIN = "DOMAIN"
    SENIORITY = "SENIORITY"
    LOCATION = "LOCATION"
    WORK_AUTHORIZATION = "WORK_AUTHORIZATION"
    OTHER = "OTHER"


class JobRequirementImportance(enum.StrEnum):
    REQUIRED = "REQUIRED"
    PREFERRED = "PREFERRED"
    INFERRED_PRIORITY = "INFERRED_PRIORITY"


class RequirementConfidence(enum.StrEnum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class EvidenceSupportStrength(enum.StrEnum):
    STRONG = "STRONG"
    WEAK = "WEAK"
    NONE_OR_INSUFFICIENT = "NONE_OR_INSUFFICIENT"


class ResumeRepresentation(enum.StrEnum):
    REPRESENTED = "REPRESENTED"
    UNDERREPRESENTED = "UNDERREPRESENTED"
    ABSENT = "ABSENT"


class IntelligenceClassification(enum.StrEnum):
    STRONG_EVIDENCE = "STRONG_EVIDENCE"
    HIDDEN_EVIDENCE = "HIDDEN_EVIDENCE"
    WEAK_EVIDENCE = "WEAK_EVIDENCE"
    GENUINE_GAP = "GENUINE_GAP"


class ApplicationRecommendation(enum.StrEnum):
    STRONG_APPLY = "STRONG_APPLY"
    APPLY = "APPLY"
    STRETCH = "STRETCH"
    LOW_PRIORITY = "LOW_PRIORITY"


# ---------------------------------------------------------------------------
# M1A — Identity
# ---------------------------------------------------------------------------


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid4)
    auth_provider: Mapped[str] = mapped_column(sa.String(50))
    auth_subject: Mapped[str] = mapped_column(sa.String(255))
    email: Mapped[str | None] = mapped_column(sa.String(255))
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )

    career_brain: Mapped["CareerBrain"] = relationship(back_populates="user")
    resumes: Mapped[list["Resume"]] = relationship(back_populates="user")
    jobs: Mapped[list["Job"]] = relationship(back_populates="user")

    __table_args__ = (sa.UniqueConstraint("auth_provider", "auth_subject"),)


class CareerBrain(Base):
    __tablename__ = "career_brains"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(sa.ForeignKey("users.id"), unique=True)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )

    user: Mapped["User"] = relationship(back_populates="career_brain")
    educations: Mapped[list["Education"]] = relationship(back_populates="career_brain")
    experiences: Mapped[list["Experience"]] = relationship(back_populates="career_brain")
    projects: Mapped[list["Project"]] = relationship(back_populates="career_brain")
    skills: Mapped[list["Skill"]] = relationship(back_populates="career_brain")


# ---------------------------------------------------------------------------
# M1B — Career Entities
# ---------------------------------------------------------------------------


class Education(Base):
    __tablename__ = "educations"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid4)
    career_brain_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey("career_brains.id", ondelete="CASCADE")
    )
    institution: Mapped[str] = mapped_column(sa.String(500))
    degree: Mapped[str | None] = mapped_column(sa.String(500))
    field_of_study: Mapped[str | None] = mapped_column(sa.String(500))
    location: Mapped[str | None] = mapped_column(sa.String(500))
    start_date: Mapped[str | None] = mapped_column(sa.String(10))
    end_date: Mapped[str | None] = mapped_column(sa.String(10))
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )

    career_brain: Mapped["CareerBrain"] = relationship(back_populates="educations")

    __table_args__ = (sa.Index("ix_educations_career_brain_id", "career_brain_id"),)


class Experience(Base):
    __tablename__ = "experiences"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid4)
    career_brain_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey("career_brains.id", ondelete="CASCADE")
    )
    company: Mapped[str] = mapped_column(sa.String(500))
    title: Mapped[str] = mapped_column(sa.String(500))
    location: Mapped[str | None] = mapped_column(sa.String(500))
    start_date: Mapped[str | None] = mapped_column(sa.String(10))
    end_date: Mapped[str | None] = mapped_column(sa.String(10))
    is_current: Mapped[bool] = mapped_column(sa.Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )

    career_brain: Mapped["CareerBrain"] = relationship(back_populates="experiences")
    details: Mapped[list["ExperienceDetail"]] = relationship(
        back_populates="experience", cascade="all, delete-orphan"
    )

    __table_args__ = (sa.Index("ix_experiences_career_brain_id", "career_brain_id"),)


class ExperienceDetail(Base):
    __tablename__ = "experience_details"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid4)
    experience_id: Mapped[UUID] = mapped_column(sa.ForeignKey("experiences.id", ondelete="CASCADE"))
    content: Mapped[str] = mapped_column(sa.Text)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )

    experience: Mapped["Experience"] = relationship(back_populates="details")

    __table_args__ = (sa.Index("ix_experience_details_experience_id", "experience_id"),)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid4)
    career_brain_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey("career_brains.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(sa.String(500))
    description: Mapped[str | None] = mapped_column(sa.Text)
    url: Mapped[str | None] = mapped_column(sa.String(2000))
    start_date: Mapped[str | None] = mapped_column(sa.String(10))
    end_date: Mapped[str | None] = mapped_column(sa.String(10))
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )

    career_brain: Mapped["CareerBrain"] = relationship(back_populates="projects")
    details: Mapped[list["ProjectDetail"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )

    __table_args__ = (sa.Index("ix_projects_career_brain_id", "career_brain_id"),)


class ProjectDetail(Base):
    __tablename__ = "project_details"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(sa.ForeignKey("projects.id", ondelete="CASCADE"))
    content: Mapped[str] = mapped_column(sa.Text)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )

    project: Mapped["Project"] = relationship(back_populates="details")

    __table_args__ = (sa.Index("ix_project_details_project_id", "project_id"),)


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid4)
    career_brain_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey("career_brains.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(sa.String(500))
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )

    career_brain: Mapped["CareerBrain"] = relationship(back_populates="skills")

    __table_args__ = (sa.Index("ix_skills_career_brain_id", "career_brain_id"),)


# ---------------------------------------------------------------------------
# M1B — Career Evidence
# ---------------------------------------------------------------------------


class CareerEvidence(Base):
    __tablename__ = "career_evidence"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid4)
    career_brain_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey("career_brains.id", ondelete="CASCADE")
    )
    source_type: Mapped[str] = mapped_column(sa.String(50))
    source_id: Mapped[UUID] = mapped_column(sa.Uuid)
    # No FK constraint on current_revision_id to avoid circular FK.
    # Application code guarantees this points to a revision belonging
    # to the same evidence record.
    current_revision_id: Mapped[UUID | None] = mapped_column(sa.Uuid, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )

    revisions: Mapped[list["CareerEvidenceRevision"]] = relationship(
        back_populates="evidence",
        cascade="all, delete-orphan",
        foreign_keys="[CareerEvidenceRevision.evidence_id]",
    )
    current_revision: Mapped["CareerEvidenceRevision | None"] = relationship(
        primaryjoin="CareerEvidence.current_revision_id == CareerEvidenceRevision.id",
        foreign_keys="[CareerEvidence.current_revision_id]",
        uselist=False,
        viewonly=True,
    )

    __table_args__ = (
        sa.UniqueConstraint("source_type", "source_id"),
        sa.Index("ix_career_evidence_career_brain_id", "career_brain_id"),
    )


class CareerEvidenceRevision(Base):
    __tablename__ = "career_evidence_revisions"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid4)
    evidence_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey("career_evidence.id", ondelete="CASCADE")
    )
    revision_number: Mapped[int] = mapped_column(sa.Integer)
    content: Mapped[str] = mapped_column(sa.Text)
    origin: Mapped[str] = mapped_column(sa.String(50))
    confirmation_status: Mapped[str] = mapped_column(sa.String(50))
    created_by: Mapped[str] = mapped_column(sa.String(50))
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )

    evidence: Mapped["CareerEvidence"] = relationship(
        back_populates="revisions",
        foreign_keys=[evidence_id],
    )

    __table_args__ = (
        sa.UniqueConstraint("evidence_id", "revision_number"),
        sa.Index("ix_career_evidence_revisions_evidence_id", "evidence_id"),
    )


# ---------------------------------------------------------------------------
# M2/M3 — Resume ingestion and immutable resume versions
# ---------------------------------------------------------------------------


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(sa.ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(sa.String(500))
    type: Mapped[str] = mapped_column(sa.String(50))
    is_primary: Mapped[bool] = mapped_column(sa.Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )

    user: Mapped["User"] = relationship(back_populates="resumes")
    versions: Mapped[list["ResumeVersion"]] = relationship(
        back_populates="resume", cascade="all, delete-orphan"
    )

    __table_args__ = (sa.Index("ix_resumes_user_id", "user_id"),)


class ResumeAsset(Base):
    __tablename__ = "resume_assets"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(sa.ForeignKey("users.id", ondelete="CASCADE"))
    storage_key: Mapped[str] = mapped_column(sa.String(255), unique=True)
    original_filename: Mapped[str] = mapped_column(sa.String(500))
    content_type: Mapped[str] = mapped_column(sa.String(100))
    size_bytes: Mapped[int] = mapped_column(sa.BigInteger)
    sha256: Mapped[str] = mapped_column(sa.String(64))
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )

    __table_args__ = (sa.Index("ix_resume_assets_user_id", "user_id"),)


class ResumeVersion(Base):
    __tablename__ = "resume_versions"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid4)
    resume_id: Mapped[UUID] = mapped_column(sa.ForeignKey("resumes.id", ondelete="CASCADE"))
    asset_id: Mapped[UUID] = mapped_column(sa.ForeignKey("resume_assets.id", ondelete="CASCADE"))
    version_number: Mapped[int] = mapped_column(sa.Integer)
    source: Mapped[str] = mapped_column(sa.String(50))
    created_by: Mapped[str] = mapped_column(sa.String(50))
    source_version_id: Mapped[UUID | None] = mapped_column(
        sa.ForeignKey("resume_versions.id", ondelete="SET NULL")
    )
    extracted_text: Mapped[str] = mapped_column(sa.Text)
    structured_content: Mapped[dict[str, object]] = mapped_column(sa.JSON)
    parser_version: Mapped[str] = mapped_column(sa.String(100))
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )

    resume: Mapped["Resume"] = relationship(back_populates="versions")
    asset: Mapped["ResumeAsset"] = relationship()
    source_version: Mapped["ResumeVersion | None"] = relationship(remote_side=[id])

    __table_args__ = (
        sa.UniqueConstraint("resume_id", "version_number"),
        sa.Index("ix_resume_versions_resume_id", "resume_id"),
    )


class ResumeImport(Base):
    __tablename__ = "resume_imports"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(sa.ForeignKey("users.id", ondelete="CASCADE"))
    career_brain_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey("career_brains.id", ondelete="CASCADE")
    )
    resume_version_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey("resume_versions.id", ondelete="CASCADE"), unique=True
    )
    status: Mapped[str] = mapped_column(sa.String(50))
    error_code: Mapped[str | None] = mapped_column(sa.String(100))
    error_message: Mapped[str | None] = mapped_column(sa.Text)
    confirmed_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )

    version: Mapped["ResumeVersion"] = relationship()
    items: Mapped[list["ResumeDraftItem"]] = relationship(
        back_populates="resume_import", cascade="all, delete-orphan"
    )

    __table_args__ = (
        sa.Index("ix_resume_imports_user_id", "user_id"),
        sa.Index("ix_resume_imports_career_brain_id", "career_brain_id"),
    )


class ResumeDraftItem(Base):
    __tablename__ = "resume_draft_items"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid4)
    resume_import_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey("resume_imports.id", ondelete="CASCADE")
    )
    parent_item_id: Mapped[UUID | None] = mapped_column(
        sa.ForeignKey("resume_draft_items.id", ondelete="CASCADE")
    )
    item_type: Mapped[str] = mapped_column(sa.String(50))
    data: Mapped[dict[str, object]] = mapped_column(sa.JSON)
    position: Mapped[int] = mapped_column(sa.Integer)
    status: Mapped[str] = mapped_column(sa.String(50))
    materialized_source_type: Mapped[str | None] = mapped_column(sa.String(50))
    materialized_source_id: Mapped[UUID | None] = mapped_column(sa.Uuid)
    evidence_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey("career_evidence.id", ondelete="CASCADE"), unique=True
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )

    resume_import: Mapped["ResumeImport"] = relationship(back_populates="items")
    evidence: Mapped["CareerEvidence"] = relationship()

    __table_args__ = (
        sa.Index("ix_resume_draft_items_resume_import_id", "resume_import_id"),
        sa.Index("ix_resume_draft_items_parent_item_id", "parent_item_id"),
    )


# ---------------------------------------------------------------------------
# M4 — Job capture and immutable parsed snapshots
# ---------------------------------------------------------------------------


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(sa.ForeignKey("users.id", ondelete="CASCADE"))
    company: Mapped[str] = mapped_column(sa.String(500))
    title: Mapped[str] = mapped_column(sa.String(500))
    location: Mapped[str | None] = mapped_column(sa.String(500))
    source_url: Mapped[str | None] = mapped_column(sa.String(2000))
    application_url: Mapped[str | None] = mapped_column(sa.String(2000))
    source_type: Mapped[str] = mapped_column(sa.String(50))
    captured_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )

    user: Mapped["User"] = relationship(back_populates="jobs")
    snapshots: Mapped[list["JobSnapshot"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )

    __table_args__ = (sa.Index("ix_jobs_user_id", "user_id"),)


class JobSnapshot(Base):
    __tablename__ = "job_snapshots"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid4)
    job_id: Mapped[UUID] = mapped_column(sa.ForeignKey("jobs.id", ondelete="CASCADE"))
    version_number: Mapped[int] = mapped_column(sa.Integer)
    raw_description: Mapped[str] = mapped_column(sa.Text)
    normalized_description: Mapped[str] = mapped_column(sa.Text)
    content_sha256: Mapped[str] = mapped_column(sa.String(64))
    parser_version: Mapped[str] = mapped_column(sa.String(100))
    parser_model: Mapped[str] = mapped_column(sa.String(100))
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )

    job: Mapped["Job"] = relationship(back_populates="snapshots")
    requirements: Mapped[list["JobRequirement"]] = relationship(
        back_populates="job_snapshot", cascade="all, delete-orphan"
    )

    __table_args__ = (
        sa.UniqueConstraint("job_id", "version_number"),
        sa.Index("ix_job_snapshots_job_id", "job_id"),
    )


class JobRequirement(Base):
    __tablename__ = "job_requirements"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid4)
    job_snapshot_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey("job_snapshots.id", ondelete="CASCADE")
    )
    category: Mapped[str] = mapped_column(sa.String(50))
    description: Mapped[str] = mapped_column(sa.Text)
    normalized_value: Mapped[str | None] = mapped_column(sa.String(500))
    importance: Mapped[str] = mapped_column(sa.String(50))
    source_text: Mapped[str] = mapped_column(sa.Text)
    confidence: Mapped[str] = mapped_column(sa.String(50))
    position: Mapped[int] = mapped_column(sa.Integer)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )

    job_snapshot: Mapped["JobSnapshot"] = relationship(back_populates="requirements")
    evidence_matches: Mapped[list["EvidenceMatch"]] = relationship(back_populates="job_requirement")

    __table_args__ = (
        sa.UniqueConstraint("job_snapshot_id", "position"),
        sa.Index("ix_job_requirements_snapshot_id", "job_snapshot_id"),
    )


# ---------------------------------------------------------------------------
# M5/M6 — Reproducible evidence matching and resume representation
# ---------------------------------------------------------------------------


class JobAnalysis(Base):
    __tablename__ = "job_analyses"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(sa.ForeignKey("users.id", ondelete="CASCADE"))
    job_id: Mapped[UUID] = mapped_column(sa.ForeignKey("jobs.id", ondelete="CASCADE"))
    job_snapshot_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey("job_snapshots.id", ondelete="CASCADE")
    )
    career_brain_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey("career_brains.id", ondelete="CASCADE")
    )
    resume_version_id: Mapped[UUID] = mapped_column(sa.ForeignKey("resume_versions.id"))
    analysis_version: Mapped[int] = mapped_column(sa.Integer)
    matcher_version: Mapped[str] = mapped_column(sa.String(100))
    matcher_model: Mapped[str] = mapped_column(sa.String(100))
    overall_recommendation: Mapped[str] = mapped_column(sa.String(50))
    summary: Mapped[str] = mapped_column(sa.Text)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )

    job: Mapped["Job"] = relationship()
    job_snapshot: Mapped["JobSnapshot"] = relationship()
    resume_version: Mapped["ResumeVersion"] = relationship()
    matches: Mapped[list["EvidenceMatch"]] = relationship(
        back_populates="job_analysis", cascade="all, delete-orphan"
    )

    __table_args__ = (
        sa.UniqueConstraint("job_id", "analysis_version"),
        sa.Index("ix_job_analyses_user_id", "user_id"),
        sa.Index("ix_job_analyses_job_id", "job_id"),
    )


class EvidenceMatch(Base):
    __tablename__ = "evidence_matches"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid4)
    job_analysis_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey("job_analyses.id", ondelete="CASCADE")
    )
    job_requirement_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey("job_requirements.id", ondelete="CASCADE")
    )
    support_strength: Mapped[str] = mapped_column(sa.String(50))
    resume_representation: Mapped[str] = mapped_column(sa.String(50))
    classification: Mapped[str] = mapped_column(sa.String(50))
    explanation: Mapped[str] = mapped_column(sa.Text)
    resume_source_text: Mapped[str | None] = mapped_column(sa.Text)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )

    job_analysis: Mapped["JobAnalysis"] = relationship(back_populates="matches")
    job_requirement: Mapped["JobRequirement"] = relationship(back_populates="evidence_matches")
    evidence_references: Mapped[list["EvidenceMatchReference"]] = relationship(
        back_populates="evidence_match", cascade="all, delete-orphan"
    )

    __table_args__ = (
        sa.UniqueConstraint("job_analysis_id", "job_requirement_id"),
        sa.Index("ix_evidence_matches_analysis_id", "job_analysis_id"),
    )


class EvidenceMatchReference(Base):
    __tablename__ = "evidence_match_references"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid4)
    evidence_match_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey("evidence_matches.id", ondelete="CASCADE")
    )
    career_evidence_id: Mapped[UUID] = mapped_column(sa.Uuid)
    career_evidence_revision_id: Mapped[UUID] = mapped_column(sa.Uuid)
    source_type: Mapped[str] = mapped_column(sa.String(50))
    source_id: Mapped[UUID] = mapped_column(sa.Uuid)
    evidence_content: Mapped[str] = mapped_column(sa.Text)
    revision_number: Mapped[int] = mapped_column(sa.Integer)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )

    evidence_match: Mapped["EvidenceMatch"] = relationship(back_populates="evidence_references")

    __table_args__ = (
        sa.UniqueConstraint("evidence_match_id", "career_evidence_revision_id"),
        sa.Index("ix_match_references_match_id", "evidence_match_id"),
    )
