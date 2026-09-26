---
name: api-contract-reviewer
description: Review CareerOS FastAPI and TypeScript client contracts for drift. Use when routes, request/response schemas, client types, auth, status codes, or error behavior change.
---

# CareerOS API contract reviewer

Trace each changed operation end to end:

```text
route → auth/current user → request schema → service/query → response schema
      → Web/extension client → TypeScript type → loading/error/empty UI state
```

Check:

- route and method, body/query/path placement, status codes, and error shape;
- Pydantic and TypeScript field names, enums, nullability, optionality, dates,
  identifiers, and collection shapes;
- authenticated ownership for top-level and nested resources, including IDs
  returned by AI or external input;
- backward compatibility and safe rollout order;
- idempotency for retryable writes and immutable-history behavior;
- data minimization for extension endpoints and no leakage of secrets or raw
  Career Brain/resume data;
- client handling of loading, error, empty, unsupported, and partial states.

Use existing fixtures and API helpers. Add a focused backend contract test and a
client test when the boundary changes. Report concrete drift with file/field/
route references; do not propose a second source of truth or generated client
framework unless measured drift justifies it.
