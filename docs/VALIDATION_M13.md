# M13 Autofill and Initial ATS Support Validation

> Status: Automated validation passed; representative Chrome check deferred
> Validated: 2026-09-25

## Scope

This validation covers user-triggered safe form execution, exact field
revalidation, non-overwrite behavior, per-field review markers, generic and
initial ATS adapter boundaries, strict messaging, and the no-submit invariant.
It does not validate durable Application Memory or automatic file upload.

## Automated verification

- Only approved `FILL` decisions for executable controls carry an answer into
  the content script.
- Suggestions, confirmations, unknowns, and user-input decisions are marked but
  not filled.
- Exact deterministic labels can become high confidence; broader matches remain
  reviewable medium-confidence mappings.
- Existing page values are preserved.
- Field ID, canonical key, and control type are revalidated immediately before
  execution; changed or missing targets fail closed.
- Text-like controls dispatch input and change events after successful writes.
- File and unsupported controls remain manual.
- Generic, Greenhouse, Lever, and Ashby fixture paths use the provider-neutral
  executor.
- Visible markers distinguish filled, review, input, unresolved, preserved, and
  failed states.
- Fill messages are exact, bounded, unique, and reject file execution or answer
  values attached to non-fill actions.
- Tests verify that execution neither clicks nor submits the application form.
- Build validation confirms least-privilege permissions, credential isolation,
  execution markers, and absence of submission APIs in the content bundle.

## Representative browser status

The user chose to skip unpacked-extension setup and continue development. The
M12 and M13 representative Chrome checks therefore remain unexecuted rather than
being reported as passed.

When resumed, load `apps/extension/build`, run the authenticated API and fixture,
request the fill plan, and verify that only blank approved fields change, all
states are visible, existing values remain unchanged, and Submit remains solely
under user control.

## Known limitations

- Current canonical data resolves only the sources documented in
  `docs/ANSWER_ENGINE.md`; unsupported profile data remains unknown.
- Resume/file controls require manual user selection in the current browser
  boundary.
- ATS coverage is fixture-based and provider DOM changes can require adapter
  maintenance.
- Dynamic custom widgets outside native supported controls remain manual.
- No answer, fill plan, or Application is persisted in M13.
