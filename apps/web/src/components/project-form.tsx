"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectSummary } from "@/lib/types";

type ProjectFormData = {
  name: string;
  description: string | null;
  url: string | null;
  start_date: string | null;
  end_date: string | null;
};

type ProjectFormProps = {
  initial?: ProjectSummary;
  onSubmit: (data: ProjectFormData) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  error?: string | null;
};

function ProjectForm({
  initial,
  onSubmit,
  onCancel,
  loading,
  error,
}: ProjectFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [startDate, setStartDate] = useState(initial?.start_date ?? "");
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    await onSubmit({
      name: trimmedName,
      description: description.trim() || null,
      url: url.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Project Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={500}
        placeholder="My Open Source Project"
      />
      <Textarea
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="A brief description of the project..."
      />
      <Input
        label="URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        maxLength={2000}
        placeholder="https://github.com/user/project"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Start Date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          maxLength={10}
          placeholder="2023-01"
        />
        <Input
          label="End Date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          maxLength={10}
          placeholder="2023-12"
        />
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {initial ? "Save" : "Add"}
        </Button>
      </div>
    </form>
  );
}

export { ProjectForm };
export type { ProjectFormData };
