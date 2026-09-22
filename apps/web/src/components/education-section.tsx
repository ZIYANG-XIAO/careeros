"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";

import { DeleteConfirmation } from "@/components/delete-confirmation";
import { EducationForm } from "@/components/education-form";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DropdownItem, DropdownMenu } from "@/components/ui/dropdown-menu";
import { createEducation, deleteEducation, updateEducation } from "@/lib/api";
import type { EducationSummary } from "@/lib/types";

type EducationSectionProps = {
  educations: EducationSummary[];
  onMutate: () => Promise<void>;
};

function EducationSection({ educations, onMutate }: EducationSectionProps) {
  const { getToken } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<EducationSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EducationSummary | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const handleCreate = async (data: Parameters<typeof createEducation>[1]) => {
    setLoading(true);
    setMutationError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await createEducation(token, data);
      await onMutate();
      setShowCreate(false);
    } catch {
      setMutationError("Failed to add education. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (data: Parameters<typeof updateEducation>[2]) => {
    if (!editTarget) return;
    setLoading(true);
    setMutationError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await updateEducation(token, editTarget.id, data);
      await onMutate();
      setEditTarget(null);
    } catch {
      setMutationError("Failed to update education. Please try again.");
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
      await deleteEducation(token, deleteTarget.id);
      await onMutate();
      setDeleteTarget(null);
    } catch {
      setMutationError("Failed to delete education. Please try again.");
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
      aria-labelledby="education-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="education-heading"
            className="text-lg font-semibold text-slate-900"
          >
            Education
          </h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            Schools, degrees, and fields of study that shape your background.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setShowCreate(true)}>
          Add education
        </Button>
      </div>

      {educations.length === 0 ? (
        <EmptyState
          title="No education yet"
          description="Add a school or program to begin your academic history."
        />
      ) : (
        <ul className="mt-4 space-y-3">
          {educations.map((edu) => (
            <li
              key={edu.id}
              className="rounded-xl border border-slate-200 bg-slate-50/40 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">
                    {edu.institution}
                  </p>
                  {(edu.degree || edu.field_of_study) && (
                    <p className="mt-0.5 truncate text-sm text-slate-600">
                      {[edu.degree, edu.field_of_study]
                        .filter(Boolean)
                        .join(" — ")}
                    </p>
                  )}
                  <p className="mt-0.5 truncate text-sm text-slate-400">
                    {[
                      edu.location,
                      formatDateRange(edu.start_date, edu.end_date),
                    ]
                      .filter(Boolean)
                      .join(" | ")}
                  </p>
                </div>
                <DropdownMenu label={`Actions for ${edu.institution}`}>
                  <DropdownItem onClick={() => setEditTarget(edu)}>
                    Edit
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => setDeleteTarget(edu)}
                    variant="danger"
                  >
                    Delete
                  </DropdownItem>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={showCreate} onClose={closeCreate} title="Add Education">
        <EducationForm
          onSubmit={handleCreate}
          onCancel={closeCreate}
          loading={loading}
          error={mutationError}
        />
      </Dialog>

      <Dialog open={!!editTarget} onClose={closeEdit} title="Edit Education">
        {editTarget && (
          <EducationForm
            initial={editTarget}
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
        entityName="Education"
        error={mutationError}
      />
    </section>
  );
}

function formatDateRange(
  start: string | null,
  end: string | null,
): string | null {
  if (!start && !end) return null;
  return `${start ?? "?"} — ${end ?? "Present"}`;
}

export { EducationSection };
