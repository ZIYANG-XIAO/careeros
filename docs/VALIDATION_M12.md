# M12 Answer Engine Foundation Validation

> Status: Automated validation passed; representative Chrome check deferred
> Validated: 2026-09-25

## Scope

This validation covers authenticated answer decisions, deterministic and
optional semantic classification, owned source retrieval, sensitivity/reuse
policy, safe unknown behavior, and the privileged extension boundary. It does
not validate autofill, file upload execution, Application Memory, or submission.

## Automated verification

- Identity email, one unambiguous Education, one explicit current Experience,
  and an owned selected Resume Version resolve from canonical sources.
- Multiple Education or current Experience records remain unresolved rather
  than being guessed.
- Missing required fields ask the user; missing optional fields remain unknown.
- Sensitive and consequential categories are detected before semantic
  classification, never inferred, and prohibited from reusable storage.
- Normal custom questions require explicit save intent before future reuse.
- Semantic classifications cannot claim high confidence, create request IDs,
  classify file controls, or bypass deterministic sensitive policy.
- Semantic failure safely falls back without changing canonical data.
- Foreign Resume Version references are rejected.
- Extension messages are exact, bounded, and authenticated in the background.
- Answer values and answer-resolution messages are absent from the content
  script bundle.
- The popup reports only aggregate decision counts and states that nothing was
  filled.

## Representative browser status

The user chose to skip unpacked-extension setup and continue development, so
this check was not executed and is not reported as passed. When resumed, reload
the unpacked extension after the M12 build, run the authenticated API, and open
the generic fixture. Verify the existing form-inspection result plus an `Answer
decisions ready` summary. The page must remain unchanged and the popup must
continue to state that CareerOS never submits an application.

## Known limitations

- Current canonical sources do not yet contain name, phone, address,
  professional-link, preference, or reusable-answer records.
- The popup does not yet provide Resume Version selection or per-field answer
  review.
- Semantic classification requires configured provider credentials; without
  them, deterministic behavior remains available and unknown stays unknown.
- No answer or decision is persisted in M12.
- Autofill and form execution begin only in M13.
