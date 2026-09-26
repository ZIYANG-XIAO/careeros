---
name: bug-fixer
description: Diagnose and fix a reproducible CareerOS defect with evidence and regression coverage. Use for broken behavior, failing tests, regressions, or error reports; not for feature expansion.
---

# CareerOS bug fixer

1. Reproduce the symptom with the smallest reliable command, request, fixture,
   or browser flow. Record observed behavior rather than guessing.
2. Trace the failing path through its owning boundary. Check adjacent ownership,
   history, auth, API, and UI-state behavior where relevant.
3. Identify the root cause and explain why the current tests missed it.
4. Add a regression test before the fix when practical. Choose the lowest layer
   that proves user-visible behavior; avoid assertions that merely mirror the
   implementation.
5. Make the minimal correction. Do not mix cleanup or speculative edits into the
   fix.
6. Run the regression test, the affected suite, and neighboring checks from
   `AGENTS.md`. For extension bugs, also run the production build boundary check.
7. Review the final diff and confirm the original reproduction now passes.

Stop and surface ambiguity if the observed behavior conflicts with approved
product docs. Never weaken ownership, evidence, sensitive-answer, history, or
no-submit safeguards just to make a failing case pass.
