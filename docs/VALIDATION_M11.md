# M11 Form Detection and Normalization Validation

> Status: Passed
> Validated: 2026-09-24

## Scope

This validation covers read-only form detection, provider-neutral field
normalization, generic and initial ATS adapter boundaries, support/confidence
states, bounded untrusted input, and honest popup copy. It does not validate the
Answer Engine, autofill, resume upload, Application Memory, or submission.

## Automated verification

- Generic application fixtures produce stable normalized forms and canonical
  keys for approved initial fields.
- Greenhouse, Lever, and Ashby fixtures select isolated adapters while sharing
  the provider-neutral normalizer.
- Unknown custom questions remain unknown with low confidence.
- Hostile instruction-like labels remain inert untrusted text.
- Current input values and hidden values are absent from inspection results.
- Radio groups and select options normalize without reading selected answers.
- Unsupported controls remain explicit; hidden/action controls are omitted.
- Popup copy reports aggregate recognized/review counts and states that autofill
  is not enabled.
- Extension type checking, formatting, build, credential-boundary validation,
  least-privilege permissions, and stable development identity pass.

## Representative browser validation

The unpacked `apps/extension/build` extension was loaded and enabled in the
connected Chrome profile with the expected stable extension ID. On the local
generic application fixture, the popup reported `Application form inspected`,
with four recognized fields and one field requiring manual review. It also
stated that autofill is not enabled and that CareerOS never submits an
application.

The local CareerOS API was not running during this check, so the independent
account-status card showed `CareerOS is unavailable.` Page inspection still
completed successfully; authenticated API access was already validated in M10.

## Security and privacy observations

- Inspection occurs only after the user opens the popup on the active HTTP(S)
  tab.
- The content script receives no CareerOS token, Career Brain data, or answers.
- Normalization reads structure and bounded labels/options, never current field
  values.
- No normalized form or page text is persisted or sent to the backend in M11.
- Page text cannot select an adapter, change canonical keys beyond deterministic
  mappings, or trigger privileged operations.

## Known limitations

- ATS coverage is fixture-based and provider DOM can change.
- Dynamic controls added after inspection require another popup inspection.
- Custom questions remain unknown until M12 classification and policy exist.
- M11 does not fill, upload, save answers, create Applications, or submit.
