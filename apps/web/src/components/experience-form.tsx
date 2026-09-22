"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ExperienceSummary } from "@/lib/types";

type ExperienceFormData = {
  company: string;
  title: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
};

type ExperienceFormProps = {
  initial?: ExperienceSummary;
  onSubmit: (data: ExperienceFormData) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  error?: string | null;
};

function ExperienceForm({
  initial,
  onSubmit,
  onCancel,
  loading,
  error,
}: ExperienceFormProps) {
  const [company, setCompany] = useState(initial?.company ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [startDate, setStartDate] = useState(initial?.start_date ?? "");
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");
  const [isCurrent, setIsCurrent] = useState(initial?.is_current ?? false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedCompany = company.trim();
    const trimmedTitle = title.trim();
    if (!trimmedCompany || !trimmedTitle) return;
    await onSubmit({
      company: trimmedCompany,
      title: trimmedTitle,
      location: location.trim() || null,
      start_date: startDate || null,
      end_date: isCurrent ? null : endDate || null,
      is_current: isCurrent,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Company"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        required
        maxLength={500}
        placeholder="Acme Corp"
      />
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        maxLength={500}
        placeholder="Software Engineer"
      />
      <Input
        label="Location"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        maxLength={500}
        placeholder="San Francisco, CA"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Start Date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          maxLength={10}
          placeholder="2022-01"
        />
        <Input
          label="End Date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          maxLength={10}
          placeholder="2024-06"
          disabled={isCurrent}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={isCurrent}
          onChange={(e) => {
            setIsCurrent(e.target.checked);
            if (e.target.checked) setEndDate("");
          }}
          className="rounded border-slate-300"
        />
        Currently working here
      </label>
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

export { ExperienceForm };
export type { ExperienceFormData };
