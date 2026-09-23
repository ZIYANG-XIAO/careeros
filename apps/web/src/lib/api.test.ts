import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEducation,
  createExperience,
  createExperienceDetail,
  createProject,
  createProjectDetail,
  createSkill,
  deleteEducation,
  deleteExperience,
  deleteExperienceDetail,
  deleteProject,
  deleteProjectDetail,
  deleteSkill,
  getCareerBrain,
  getCurrentUser,
  getResumeImport,
  getSystemHealth,
  listJobs,
  listResumes,
  removeResumeDraftItem,
  saveJob,
  unsaveJob,
  updateEducation,
  updateExperience,
  updateExperienceDetail,
  updateProject,
  updateProjectDetail,
  updateResumeDraftItem,
  updateSkill,
  uploadResume,
  confirmResumeImport,
} from "./api";

const BASE = "http://localhost:8000";
const TOKEN = "test-token";

function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

function mock204() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 204,
  });
}

describe("API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  function setup(body: unknown, status?: number) {
    process.env.NEXT_PUBLIC_API_URL = BASE;
    const fetchMock = status === 204 ? mock204() : mockFetch(body, status);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------

  describe("getSystemHealth", () => {
    it("returns health data", async () => {
      const f = setup({ status: "ok", database: "connected" });
      const result = await getSystemHealth();
      expect(result).toEqual({ status: "ok", database: "connected" });
      expect(f).toHaveBeenCalledWith(`${BASE}/health`, { cache: "no-store" });
    });

    it("throws when API URL is missing", async () => {
      await expect(getSystemHealth()).rejects.toThrow(
        "NEXT_PUBLIC_API_URL is required",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // User
  // ---------------------------------------------------------------------------

  describe("getCurrentUser", () => {
    it("fetches current user", async () => {
      const user = { id: "u1", email: "a@b.com", created_at: "2026-01-01" };
      const f = setup(user);
      const result = await getCurrentUser(TOKEN);
      expect(result).toEqual(user);
      expect(f).toHaveBeenCalledWith(`${BASE}/me`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
        cache: "no-store",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Career Brain
  // ---------------------------------------------------------------------------

  describe("getCareerBrain", () => {
    it("fetches career brain", async () => {
      const brain = {
        id: "b1",
        created_at: "2026-01-01",
        educations: [],
        experiences: [],
        projects: [],
        skills: [],
      };
      const f = setup(brain);
      const result = await getCareerBrain(TOKEN);
      expect(result).toEqual(brain);
      expect(f).toHaveBeenCalledWith(`${BASE}/career-brain`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
        cache: "no-store",
      });
    });
  });

  describe("Resume ingestion", () => {
    it("uploads with multipart data without overriding the browser content type", async () => {
      const imported = { id: "import-1", status: "READY_FOR_REVIEW" };
      const f = setup(imported);
      const file = new File(["resume"], "resume.pdf", {
        type: "application/pdf",
      });

      expect(await uploadResume(TOKEN, file)).toEqual(imported);
      const [, options] = f.mock.calls[0];
      expect(f).toHaveBeenCalledWith(`${BASE}/resume-imports`, {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: expect.any(FormData),
      });
      expect(options.headers).not.toHaveProperty("Content-Type");
    });

    it("fetches, edits, removes, and confirms a review draft", async () => {
      const result = { id: "import-1", items: [] };
      const f = setup(result);

      await getResumeImport(TOKEN, "import-1");
      expect(f).toHaveBeenLastCalledWith(`${BASE}/resume-imports/import-1`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
        cache: "no-store",
      });

      await updateResumeDraftItem(TOKEN, "import-1", "item-1", {
        name: "Python",
      });
      expect(f).toHaveBeenLastCalledWith(
        `${BASE}/resume-imports/import-1/items/item-1`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ data: { name: "Python" } }),
        }),
      );

      await removeResumeDraftItem(TOKEN, "import-1", "item-1");
      expect(f).toHaveBeenLastCalledWith(
        `${BASE}/resume-imports/import-1/items/item-1`,
        expect.objectContaining({ method: "DELETE" }),
      );

      await confirmResumeImport(TOKEN, "import-1");
      expect(f).toHaveBeenLastCalledWith(
        `${BASE}/resume-imports/import-1/confirm`,
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("lists the authenticated user's resume library", async () => {
      const resumes = [{ id: "resume-1", versions: [] }];
      const f = setup(resumes);
      expect(await listResumes(TOKEN)).toEqual(resumes);
      expect(f).toHaveBeenCalledWith(`${BASE}/resumes`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
        cache: "no-store",
      });
    });
  });

  describe("Jobs", () => {
    it("encodes server-owned browse filters", async () => {
      const f = setup([]);
      await listJobs(TOKEN, {
        search: " platform engineer ",
        location: "New York",
        savedOnly: true,
      });
      expect(f).toHaveBeenCalledWith(
        `${BASE}/jobs?search=platform+engineer&location=New+York&saved_only=true`,
        {
          headers: { Authorization: `Bearer ${TOKEN}` },
          cache: "no-store",
        },
      );
    });

    it("saves and unsaves through authenticated endpoints", async () => {
      const saved = { id: "job-1", is_saved: true };
      const f = setup(saved);
      expect(await saveJob(TOKEN, "job-1")).toEqual(saved);
      expect(f).toHaveBeenLastCalledWith(`${BASE}/jobs/job-1/save`, {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}` },
      });

      const deleteFetch = setup(null, 204);
      await unsaveJob(TOKEN, "job-1");
      expect(deleteFetch).toHaveBeenCalledWith(`${BASE}/jobs/job-1/save`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Education CRUD
  // ---------------------------------------------------------------------------

  describe("Education", () => {
    it("creates education", async () => {
      const edu = { id: "e1", institution: "MIT" };
      const f = setup(edu);
      const result = await createEducation(TOKEN, { institution: "MIT" });
      expect(result).toEqual(edu);
      expect(f).toHaveBeenCalledWith(`${BASE}/career-brain/educations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ institution: "MIT" }),
      });
    });

    it("updates education", async () => {
      const edu = { id: "e1", institution: "Stanford" };
      const f = setup(edu);
      const result = await updateEducation(TOKEN, "e1", {
        institution: "Stanford",
      });
      expect(result).toEqual(edu);
      expect(f).toHaveBeenCalledWith(`${BASE}/career-brain/educations/e1`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ institution: "Stanford" }),
      });
    });

    it("deletes education", async () => {
      const f = setup(null, 204);
      await deleteEducation(TOKEN, "e1");
      expect(f).toHaveBeenCalledWith(`${BASE}/career-brain/educations/e1`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Experience CRUD
  // ---------------------------------------------------------------------------

  describe("Experience", () => {
    it("creates experience", async () => {
      const exp = { id: "x1", company: "Google", title: "SWE", details: [] };
      const f = setup(exp);
      const result = await createExperience(TOKEN, {
        company: "Google",
        title: "SWE",
      });
      expect(result).toEqual(exp);
      expect(f).toHaveBeenCalledWith(`${BASE}/career-brain/experiences`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ company: "Google", title: "SWE" }),
      });
    });

    it("updates experience", async () => {
      const exp = { id: "x1", company: "Meta" };
      setup(exp);
      const result = await updateExperience(TOKEN, "x1", { company: "Meta" });
      expect(result).toEqual(exp);
    });

    it("deletes experience", async () => {
      const f = setup(null, 204);
      await deleteExperience(TOKEN, "x1");
      expect(f).toHaveBeenCalledWith(`${BASE}/career-brain/experiences/x1`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Experience Detail CRUD
  // ---------------------------------------------------------------------------

  describe("ExperienceDetail", () => {
    it("creates experience detail", async () => {
      const detail = { id: "d1", content: "Built X" };
      const f = setup(detail);
      const result = await createExperienceDetail(TOKEN, "x1", {
        content: "Built X",
      });
      expect(result).toEqual(detail);
      expect(f).toHaveBeenCalledWith(
        `${BASE}/career-brain/experiences/x1/details`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: "Built X" }),
        },
      );
    });

    it("updates experience detail", async () => {
      const detail = { id: "d1", content: "Built Y" };
      const f = setup(detail);
      const result = await updateExperienceDetail(TOKEN, "d1", {
        content: "Built Y",
      });
      expect(result).toEqual(detail);
      expect(f).toHaveBeenCalledWith(
        `${BASE}/career-brain/experience-details/d1`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: "Built Y" }),
        },
      );
    });

    it("deletes experience detail", async () => {
      const f = setup(null, 204);
      await deleteExperienceDetail(TOKEN, "d1");
      expect(f).toHaveBeenCalledWith(
        `${BASE}/career-brain/experience-details/d1`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${TOKEN}` },
        },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Project CRUD
  // ---------------------------------------------------------------------------

  describe("Project", () => {
    it("creates project", async () => {
      const proj = { id: "p1", name: "OSS", details: [] };
      const f = setup(proj);
      const result = await createProject(TOKEN, { name: "OSS" });
      expect(result).toEqual(proj);
      expect(f).toHaveBeenCalledWith(`${BASE}/career-brain/projects`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "OSS" }),
      });
    });

    it("updates project", async () => {
      const proj = { id: "p1", name: "New Name" };
      setup(proj);
      const result = await updateProject(TOKEN, "p1", { name: "New Name" });
      expect(result).toEqual(proj);
    });

    it("deletes project", async () => {
      const f = setup(null, 204);
      await deleteProject(TOKEN, "p1");
      expect(f).toHaveBeenCalledWith(`${BASE}/career-brain/projects/p1`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Project Detail CRUD
  // ---------------------------------------------------------------------------

  describe("ProjectDetail", () => {
    it("creates project detail", async () => {
      const detail = { id: "pd1", content: "Did Z" };
      const f = setup(detail);
      const result = await createProjectDetail(TOKEN, "p1", {
        content: "Did Z",
      });
      expect(result).toEqual(detail);
      expect(f).toHaveBeenCalledWith(
        `${BASE}/career-brain/projects/p1/details`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: "Did Z" }),
        },
      );
    });

    it("updates project detail", async () => {
      const detail = { id: "pd1", content: "Did W" };
      const f = setup(detail);
      const result = await updateProjectDetail(TOKEN, "pd1", {
        content: "Did W",
      });
      expect(result).toEqual(detail);
      expect(f).toHaveBeenCalledWith(
        `${BASE}/career-brain/project-details/pd1`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: "Did W" }),
        },
      );
    });

    it("deletes project detail", async () => {
      const f = setup(null, 204);
      await deleteProjectDetail(TOKEN, "pd1");
      expect(f).toHaveBeenCalledWith(
        `${BASE}/career-brain/project-details/pd1`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${TOKEN}` },
        },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Skill CRUD
  // ---------------------------------------------------------------------------

  describe("Skill", () => {
    it("creates skill", async () => {
      const skill = { id: "s1", name: "TypeScript" };
      const f = setup(skill);
      const result = await createSkill(TOKEN, { name: "TypeScript" });
      expect(result).toEqual(skill);
      expect(f).toHaveBeenCalledWith(`${BASE}/career-brain/skills`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "TypeScript" }),
      });
    });

    it("updates skill", async () => {
      const skill = { id: "s1", name: "Python" };
      setup(skill);
      const result = await updateSkill(TOKEN, "s1", { name: "Python" });
      expect(result).toEqual(skill);
    });

    it("deletes skill", async () => {
      const f = setup(null, 204);
      await deleteSkill(TOKEN, "s1");
      expect(f).toHaveBeenCalledWith(`${BASE}/career-brain/skills/s1`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe("Error handling", () => {
    it("throws on failed create", async () => {
      setup({ detail: "Bad request" }, 422);
      await expect(
        createEducation(TOKEN, { institution: "" }),
      ).rejects.toThrow();
    });

    it("throws on failed delete", async () => {
      setup({ detail: "Not found" }, 404);
      await expect(deleteEducation(TOKEN, "missing")).rejects.toThrow(
        "Failed to delete education",
      );
    });
  });
});
