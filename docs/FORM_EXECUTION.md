# CareerOS M13 Safe Form Execution Contract

> Status: Implemented foundation
> Last Updated: 2026-09-25

## 1. Purpose and boundary

M13 applies approved Answer Engine decisions to supported external application
forms after an explicit user action in the extension popup. It builds on the
M11 normalized form model and M12 Answer Engine policy; it does not create a new
answer source or weaken either contract.

```text
Normalized form
→ Answer Engine decisions
→ validated fill plan
→ explicit user action
→ safe field execution
→ visible per-field review state
→ user reviews and submits
```

CareerOS never triggers the final application submission.

## 2. Fill-plan policy

Only a decision with all of the following is executable:

- action is `FILL`;
- a non-null canonical key and proposed answer exist;
- the inspected field is still present;
- field ID, canonical key, and control type still match the fresh page model;
  and
- the control is a supported text-like or select control.

`SUGGEST`, `CONFIRM`, `ASK`, and `UNKNOWN` decisions carry no answer value into
the page. If a backend decision targets an unsupported execution control, the
extension downgrades it to review instead of filling it.

## 3. Supported execution

The generic executor supports blank text, email, phone, URL, textarea, select,
date, and number controls. It dispatches normal input/change events so supported
framework forms can observe the update.

Greenhouse, Lever, and Ashby continue to use isolated detection adapters and the
same provider-neutral execution contract. Adapter or DOM changes fail closed and
leave the original form usable.

Exact deterministic labels may receive high mapping confidence. Broader label
matches remain medium-confidence suggestions and are not silently filled.

## 4. Existing values and dynamic pages

Execution reads a control's current value only inside the active page to avoid
overwriting it. Existing answers remain untouched and are never returned to the
background service, API, popup, or logs.

Before writing, execution re-inspects the page and verifies the field signature.
If the form disappeared, reordered into a different field, changed control type,
became disabled/read-only, or rejected the value, CareerOS marks the field as
failed or requiring review rather than guessing.

## 5. Visible review states

The page receives a local visual marker for each planned field:

- filled — review the inserted value;
- review required;
- user input required;
- unresolved;
- existing answer kept; or
- fill failed.

Markers contain status only, not hidden CareerOS data. Re-running the action
replaces earlier CareerOS markers.

## 6. Resume and unsupported controls

Browsers do not permit a normal content script to assign a local file path to a
file input safely. M13 therefore marks resume/file controls for user review and
does not pretend an upload succeeded. Checkbox, unsupported controls, and any
ambiguous option match also remain manual.

Resume selection and upload may be expanded only through a separately validated
user-controlled flow that preserves the exact owned Resume Version.

Phase R adds that flow. When a page has a `RESUME_FILE` control and the user has
chosen a Resume Version in the popup, an explicit "Attach resume" action has the
background worker download the exact owned file
(`GET /resume-versions/{id}/file`) and hand it to the content script, which
assigns it to that one empty file input with `DataTransfer` and dispatches
input/change events. It never replaces a file the user already chose
(`SKIPPED_EXISTING`), respects the input's `accept` list, reports `FAILED`
honestly when a site rejects programmatic files, and still never submits.
The build validator now forbids indexing `.files` or using `FileReader` in the
content script instead of forbidding every `.files` access: content code may
assign a file and check whether one is chosen, but must never read a file the
user selected.

Custom questions (no canonical key) may be filled only from an answer the user
explicitly saved for reuse (`REUSABLE_CONFIRMED_ANSWER`); see
`docs/ANSWER_ENGINE.md` section 7.

## 7. Trust boundary

API credentials remain in the background service worker. Proposed answers enter
the content script only after the user requests execution and only for fields
approved for `FILL`. Plans are exact, bounded, unique by field ID, and validated
again at the background/content boundary.

No fill plan is persisted. The executor does not read selected files or raw page
HTML and contains no form-submit operation.
