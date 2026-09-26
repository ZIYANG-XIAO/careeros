---
name: feature-builder
description: Implement an approved CareerOS feature across Web, API, PostgreSQL, or extension boundaries. Use for feature requests that require code changes, especially full-stack work.
---

# CareerOS feature builder

Turn an approved request into the smallest coherent, verified change.

1. Read the task-relevant product contract and the matching architecture/data
   documents routed from `AGENTS.md`. Check `docs/ROADMAP.md` before treating a
   planned capability as authorized.
2. Inspect the current implementation and tests. State the objective, non-goals,
   affected domains, and any specification conflict before editing.
3. Map the change across the actual boundaries: persistence/migration, service
   behavior, Pydantic contract, TypeScript contract, UI/extension state, and
   documentation. Omit layers the feature does not need.
4. Preserve server-side ownership, immutable history, evidence grounding,
   unknown/sensitive-answer policy, provider adapters, and the extension's
   explicit-action/no-submit boundary.
5. Implement the narrow vertical slice. Do not introduce speculative
   infrastructure or unrelated refactors.
6. Add behavior-oriented tests at the lowest valuable layer and contract/E2E
   coverage only when a boundary or user journey warrants it.
7. Run focused checks first, then every affected command in `AGENTS.md`.
8. Review `git diff` for contract drift, migration risk, secrets, generated
   files, and accidental product expansion.

Return a concise summary of behavior, files, validation, and residual risks.
Do not commit, push, deploy, or mutate external systems without explicit scope.
