"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";

import { DeleteConfirmation } from "@/components/delete-confirmation";
import { DetailForm } from "@/components/detail-form";
import { ExperienceForm } from "@/components/experience-form";
import type { ExperienceFormData } from "@/components/experience-form";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DropdownItem, DropdownMenu } from "@/components/ui/dropdown-menu";
import {
  createExperience,
  createExperienceDetail,
  deleteExperience,
  deleteExperienceDetail,
  updateExperience,
  updateExperienceDetail,
} from "@/lib/api";
import { formatCareerDateRange, useI18n } from "@/lib/i18n";
import type { DetailSummary, ExperienceSummary } from "@/lib/types";
import { CompanyMark } from "@/components/company-mark";

type ExperienceSectionProps = {
  experiences: ExperienceSummary[];
  onMutate: () => Promise<void>;
};

function ExperienceSection({ experiences, onMutate }: ExperienceSectionProps) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ExperienceSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExperienceSummary | null>(
    null,
  );
  const [addDetailTo, setAddDetailTo] = useState<string | null>(null);
  const [editDetail, setEditDetail] = useState<DetailSummary | null>(null);
  const [deleteDetail, setDeleteDetail] = useState<DetailSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const handleCreate = async (data: ExperienceFormData) => {
    setLoading(true);
    setMutationError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await createExperience(token, data);
      await onMutate();
      setShowCreate(false);
    } catch {
      setMutationError(t("experience.error.add"));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (data: ExperienceFormData) => {
    if (!editTarget) return;
    setLoading(true);
    setMutationError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await updateExperience(token, editTarget.id, data);
      await onMutate();
      setEditTarget(null);
    } catch {
      setMutationError(t("experience.error.update"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    setMutationError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await deleteExperience(token, deleteTarget.id);
      await onMutate();
      setDeleteTarget(null);
    } catch {
      setMutationError(t("experience.error.delete"));
    } finally {
      setLoading(false);
    }
  };

  const handleAddDetail = async (content: string) => {
    if (!addDetailTo) return;
    setLoading(true);
    setMutationError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await createExperienceDetail(token, addDetailTo, { content });
      await onMutate();
      setAddDetailTo(null);
    } catch {
      setMutationError(t("detail.error.add"));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDetail = async (content: string) => {
    if (!editDetail) return;
    setLoading(true);
    setMutationError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await updateExperienceDetail(token, editDetail.id, { content });
      await onMutate();
      setEditDetail(null);
    } catch {
      setMutationError(t("detail.error.update"));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDetail = async () => {
    if (!deleteDetail) return;
    setLoading(true);
    setMutationError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await deleteExperienceDetail(token, deleteDetail.id);
      await onMutate();
      setDeleteDetail(null);
    } catch {
      setMutationError(t("detail.error.delete"));
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setMutationError(null);

  return (
    <section
      aria-labelledby="experience-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="experience-heading"
            className="text-lg font-semibold text-slate-900"
          >
            {t("career.sections.experience")}
          </h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            {t("career.sections.experienceDescription")}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setShowCreate(true)}>
          {t("experience.addButton")}
        </Button>
      </div>

      {experiences.length === 0 ? (
        <EmptyState
          title={t("experience.empty.title")}
          description={t("experience.empty.description")}
        />
      ) : (
        <ul className="mt-4 space-y-3">
          {experiences.map((exp) => (
            <li
              key={exp.id}
              className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <CompanyMark company={exp.company} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">
                    {exp.title}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-slate-600">
                    {exp.company}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-slate-400">
                    {[
                      exp.location,
                      formatCareerDateRange(exp.start_date, exp.end_date, t, {
                        isCurrent: exp.is_current,
                      }),
                    ]
                      .filter(Boolean)
                      .join(" | ")}
                  </p>
                </div>
                <DropdownMenu
                  label={`${t("common.actionsFor")} ${exp.title} ${t("experience.actionsAt")} ${exp.company}`}
                >
                  <DropdownItem onClick={() => setEditTarget(exp)}>
                    {t("common.edit")}
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => setDeleteTarget(exp)}
                    variant="danger"
                  >
                    {t("common.delete")}
                  </DropdownItem>
                </DropdownMenu>
              </div>

              {exp.details.length > 0 && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {t("experience.detailsHeading")}
                  </p>
                  <ul className="space-y-2">
                    {exp.details.map((d) => (
                      <li
                        key={d.id}
                        className="group/detail flex items-start justify-between text-sm text-slate-700"
                      >
                        <span className="mr-2 mt-1.5 block h-1 w-1 flex-shrink-0 rounded-full bg-slate-400" />
                        <span className="min-w-0 flex-1 break-words">
                          {d.content}
                        </span>
                        <span className="ml-2 flex flex-shrink-0 gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:focus-within:opacity-100 sm:group-hover/detail:opacity-100">
                          <button
                            type="button"
                            onClick={() => setEditDetail(d)}
                            className="rounded px-1 py-0.5 text-xs text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                            aria-label={`${t("common.edit")}: ${d.content.slice(0, 30)}`}
                          >
                            {t("common.edit")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteDetail(d)}
                            className="rounded px-1 py-0.5 text-xs text-red-400 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                            aria-label={`${t("common.delete")}: ${d.content.slice(0, 30)}`}
                          >
                            {t("common.delete")}
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                onClick={() => setAddDetailTo(exp.id)}
                className="mt-3 rounded text-xs font-medium text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                {t("experience.addDetail")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          clearError();
        }}
        title={t("experience.dialog.add")}
      >
        <ExperienceForm
          onSubmit={handleCreate}
          onCancel={() => {
            setShowCreate(false);
            clearError();
          }}
          loading={loading}
          error={mutationError}
        />
      </Dialog>

      <Dialog
        open={!!editTarget}
        onClose={() => {
          setEditTarget(null);
          clearError();
        }}
        title={t("experience.dialog.edit")}
      >
        {editTarget && (
          <ExperienceForm
            initial={editTarget}
            onSubmit={handleUpdate}
            onCancel={() => {
              setEditTarget(null);
              clearError();
            }}
            loading={loading}
            error={mutationError}
          />
        )}
      </Dialog>

      <Dialog
        open={!!addDetailTo}
        onClose={() => {
          setAddDetailTo(null);
          clearError();
        }}
        title={t("detail.dialog.add")}
      >
        <DetailForm
          onSubmit={handleAddDetail}
          onCancel={() => {
            setAddDetailTo(null);
            clearError();
          }}
          loading={loading}
          error={mutationError}
        />
      </Dialog>

      <Dialog
        open={!!editDetail}
        onClose={() => {
          setEditDetail(null);
          clearError();
        }}
        title={t("detail.dialog.edit")}
      >
        {editDetail && (
          <DetailForm
            initial={editDetail.content}
            onSubmit={handleUpdateDetail}
            onCancel={() => {
              setEditDetail(null);
              clearError();
            }}
            loading={loading}
            error={mutationError}
          />
        )}
      </Dialog>

      <DeleteConfirmation
        open={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          clearError();
        }}
        onConfirm={handleDelete}
        loading={loading}
        entityName={t("experience.entityName")}
        description={t("experience.deleteConfirm")}
        error={mutationError}
      />

      <DeleteConfirmation
        open={!!deleteDetail}
        onClose={() => {
          setDeleteDetail(null);
          clearError();
        }}
        onConfirm={handleDeleteDetail}
        loading={loading}
        entityName={t("detail.entityName")}
        description={t("detail.deleteConfirm")}
        error={mutationError}
      />
    </section>
  );
}

export { ExperienceSection };
