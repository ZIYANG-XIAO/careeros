"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";

import { DeleteConfirmation } from "@/components/delete-confirmation";
import { DetailForm } from "@/components/detail-form";
import { ProjectForm } from "@/components/project-form";
import type { ProjectFormData } from "@/components/project-form";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DropdownItem, DropdownMenu } from "@/components/ui/dropdown-menu";
import {
  createProject,
  createProjectDetail,
  deleteProject,
  deleteProjectDetail,
  updateProject,
  updateProjectDetail,
} from "@/lib/api";
import { formatCareerDateRange, useI18n } from "@/lib/i18n";
import type { DetailSummary, ProjectSummary } from "@/lib/types";

type ProjectSectionProps = {
  projects: ProjectSummary[];
  onMutate: () => Promise<void>;
};

function ProjectSection({ projects, onMutate }: ProjectSectionProps) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ProjectSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);
  const [addDetailTo, setAddDetailTo] = useState<string | null>(null);
  const [editDetail, setEditDetail] = useState<DetailSummary | null>(null);
  const [deleteDetail, setDeleteDetail] = useState<DetailSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const handleCreate = async (data: ProjectFormData) => {
    setLoading(true);
    setMutationError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await createProject(token, data);
      await onMutate();
      setShowCreate(false);
    } catch {
      setMutationError(t("project.error.add"));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (data: ProjectFormData) => {
    if (!editTarget) return;
    setLoading(true);
    setMutationError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await updateProject(token, editTarget.id, data);
      await onMutate();
      setEditTarget(null);
    } catch {
      setMutationError(t("project.error.update"));
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
      await deleteProject(token, deleteTarget.id);
      await onMutate();
      setDeleteTarget(null);
    } catch {
      setMutationError(t("project.error.delete"));
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
      await createProjectDetail(token, addDetailTo, { content });
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
      await updateProjectDetail(token, editDetail.id, { content });
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
      await deleteProjectDetail(token, deleteDetail.id);
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
      aria-labelledby="projects-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="projects-heading"
            className="text-lg font-semibold text-slate-900"
          >
            {t("career.sections.projects")}
          </h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            {t("career.sections.projectsDescription")}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setShowCreate(true)}>
          {t("project.addButton")}
        </Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title={t("project.empty.title")}
          description={t("project.empty.description")}
        />
      ) : (
        <ul className="mt-4 space-y-3">
          {projects.map((proj) => (
            <li
              key={proj.id}
              className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">
                    {proj.name}
                  </p>
                  {proj.description && (
                    <p className="mt-0.5 text-sm text-slate-600 line-clamp-2">
                      {proj.description}
                    </p>
                  )}
                  <p className="mt-0.5 truncate text-sm text-slate-400">
                    {[
                      proj.url,
                      formatCareerDateRange(proj.start_date, proj.end_date, t),
                    ]
                      .filter(Boolean)
                      .join(" | ")}
                  </p>
                </div>
                <DropdownMenu label={`${t("common.actionsFor")} ${proj.name}`}>
                  <DropdownItem onClick={() => setEditTarget(proj)}>
                    {t("common.edit")}
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => setDeleteTarget(proj)}
                    variant="danger"
                  >
                    {t("common.delete")}
                  </DropdownItem>
                </DropdownMenu>
              </div>

              {proj.details.length > 0 && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {t("project.detailsHeading")}
                  </p>
                  <ul className="space-y-2">
                    {proj.details.map((d) => (
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
                onClick={() => setAddDetailTo(proj.id)}
                className="mt-3 rounded text-xs font-medium text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                {t("project.addDetail")}
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
        title={t("project.dialog.add")}
      >
        <ProjectForm
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
        title={t("project.dialog.edit")}
      >
        {editTarget && (
          <ProjectForm
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
        entityName={t("project.entityName")}
        description={t("project.deleteConfirm")}
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

export { ProjectSection };
