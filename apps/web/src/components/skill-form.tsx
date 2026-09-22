"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SkillFormProps = {
  initial?: string;
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  error?: string | null;
};

function SkillForm({
  initial,
  onSubmit,
  onCancel,
  loading,
  error,
}: SkillFormProps) {
  const [name, setName] = useState(initial ?? "");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await onSubmit(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Skill Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={500}
        placeholder="TypeScript"
      />
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3">
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

export { SkillForm };
