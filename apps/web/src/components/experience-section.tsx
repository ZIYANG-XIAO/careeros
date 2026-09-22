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
import type { DetailSummary, ExperienceSummary } from "@/lib/types";

type ExperienceSectionProps = {
  experiences: ExperienceSummary[];
  onMutate: () => Promise<void>;
};

function ExperienceSection({ experiences, onMutate }: ExperienceSectionProps) {
  const { getToken } = useAuth();
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
      setMutationError("Failed to add experience. Please try again.");
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
      setMutationError("Failed to update experience. Please try again.");
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
      setMutationError("Failed to delete experience. Please try again.");
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
      setMutationError("Failed to add detail. Please try again.");
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
      setMutationError("Failed to update detail. Please try again.");
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
      setMutationError("Failed to delete detail. Please try again.");
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
            Experience
          </h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            Roles and meaningful work that show what you have done.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setShowCreate(true)}>
          Add experience
        </Button>
      </div>

      {experiences.length === 0 ? (
        <EmptyState
          title="No experience yet"
          description="Add a role, internship, or other professional experience."
        />
      ) : (
        <ul className="mt-4 space-y-3">
          {experiences.map((exp) => (
            <li
              key={exp.id}
              className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-2">
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
                      formatDateRange(
                        exp.start_date,
                        exp.end_date,
                        exp.is_current,
                      ),
                    ]
                      .filter(Boolean)
                      .join(" | ")}
                  </p>
                </div>
                <DropdownMenu
                  label={`Actions for ${exp.title} at ${exp.company}`}
                >
                  <DropdownItem onClick={() => setEditTarget(exp)}>
                    Edit
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => setDeleteTarget(exp)}
                    variant="danger"
                  >
                    Delete
                  </DropdownItem>
                </DropdownMenu>
              </div>

              {exp.details.length > 0 && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Experience details
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
                            aria-label={`Edit detail: ${d.content.slice(0, 30)}`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteDetail(d)}
                            className="rounded px-1 py-0.5 text-xs text-red-400 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                            aria-label={`Delete detail: ${d.content.slice(0, 30)}`}
                          >
                            Delete
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
                + Add experience detail
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
        title="Add Experience"
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
        title="Edit Experience"
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
        title="Add Detail"
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
        title="Edit Detail"
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
        entityName="Experience"
        description="Are you sure you want to delete this experience? All associated details will also be removed. This action cannot be undone."
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
        entityName="Detail"
        error={mutationError}
      />
    </section>
  );
}

function formatDateRange(
  start: string | null,
  end: string | null,
  isCurrent: boolean,
): string | null {
  if (!start && !end && !isCurrent) return null;
  const endLabel = isCurrent ? "Present" : (end ?? "?");
  return `${start ?? "?"} — ${endLabel}`;
}

export { ExperienceSection };
