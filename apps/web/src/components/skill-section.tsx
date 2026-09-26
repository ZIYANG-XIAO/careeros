"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";

import { DeleteConfirmation } from "@/components/delete-confirmation";
import { SkillForm } from "@/components/skill-form";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { createSkill, deleteSkill, updateSkill } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { SkillSummary } from "@/lib/types";

type SkillSectionProps = {
  skills: SkillSummary[];
  onMutate: () => Promise<void>;
};

function SkillSection({ skills, onMutate }: SkillSectionProps) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<SkillSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SkillSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const handleCreate = async (name: string) => {
    setLoading(true);
    setMutationError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await createSkill(token, { name });
      await onMutate();
      setShowCreate(false);
    } catch {
      setMutationError(t("skill.error.add"));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (name: string) => {
    if (!editTarget) return;
    setLoading(true);
    setMutationError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await updateSkill(token, editTarget.id, { name });
      await onMutate();
      setEditTarget(null);
    } catch {
      setMutationError(t("skill.error.update"));
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
      await deleteSkill(token, deleteTarget.id);
      await onMutate();
      setDeleteTarget(null);
    } catch {
      setMutationError(t("skill.error.delete"));
    } finally {
      setLoading(false);
    }
  };

  const closeCreate = () => {
    setShowCreate(false);
    setMutationError(null);
  };
  const closeEdit = () => {
    setEditTarget(null);
    setMutationError(null);
  };
  const closeDelete = () => {
    setDeleteTarget(null);
    setMutationError(null);
  };

  return (
    <section
      aria-labelledby="skills-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="skills-heading"
            className="text-lg font-semibold text-slate-900"
          >
            {t("career.sections.skills")}
          </h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            {t("career.sections.skillsDescription")}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setShowCreate(true)}>
          {t("skill.addButton")}
        </Button>
      </div>

      {skills.length === 0 ? (
        <EmptyState
          title={t("skill.empty.title")}
          description={t("skill.empty.description")}
        />
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <span
              key={skill.id}
              className="group/skill inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
            >
              {skill.name}
              <button
                type="button"
                onClick={() => setEditTarget(skill)}
                className="rounded text-slate-400 opacity-100 transition-opacity hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:opacity-0 sm:transition-opacity sm:focus-within:opacity-100 sm:group-hover/skill:opacity-100"
                aria-label={`${t("common.edit")} ${skill.name}`}
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(skill)}
                className="rounded text-slate-400 opacity-100 transition-opacity hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 sm:opacity-0 sm:transition-opacity sm:focus-within:opacity-100 sm:group-hover/skill:opacity-100"
                aria-label={`${t("common.delete")} ${skill.name}`}
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      <Dialog
        open={showCreate}
        onClose={closeCreate}
        title={t("skill.dialog.add")}
      >
        <SkillForm
          onSubmit={handleCreate}
          onCancel={closeCreate}
          loading={loading}
          error={mutationError}
        />
      </Dialog>

      <Dialog
        open={!!editTarget}
        onClose={closeEdit}
        title={t("skill.dialog.edit")}
      >
        {editTarget && (
          <SkillForm
            initial={editTarget.name}
            onSubmit={handleUpdate}
            onCancel={closeEdit}
            loading={loading}
            error={mutationError}
          />
        )}
      </Dialog>

      <DeleteConfirmation
        open={!!deleteTarget}
        onClose={closeDelete}
        onConfirm={handleDelete}
        loading={loading}
        entityName={t("skill.entityName")}
        description={t("skill.deleteConfirm")}
        error={mutationError}
      />
    </section>
  );
}

export { SkillSection };
