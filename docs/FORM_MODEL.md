# CareerOS M11 Normalized Form Model

> Status: Implemented for M11 detection and inspection
> Last Updated: 2026-09-25

## 1. Purpose and boundary

The normalized form model converts a supported external application form into a
small provider-neutral structure. It is transient extension workflow data, not
Career Brain truth, an Answer Engine decision, or an Application record.

M11 inspection is read-only. M13 execution reuses this model, reads current
control values only locally to prevent overwrites, and may change approved blank
controls after explicit user action. It does not read selected files, persist
page content, or submit a form.

```text
Untrusted application page
→ selected generic or ATS adapter
→ bounded field inspection
→ normalized application form
→ Answer Engine (M12)
```

## 2. Form contract

Each normalized form contains:

- a deterministic inspection-local form ID;
- adapter identity: `generic`, `greenhouse`, `lever`, `ashby`, or `workday`;
- support state: `SUPPORTED`, `PARTIALLY_SUPPORTED`, or `UNSUPPORTED`; and
- bounded normalized fields.

Each normalized field contains:

- a deterministic inspection-local field ID;
- normalized control type;
- bounded visible question/label text when available;
- required state;
- canonical key when deterministically recognized;
- support and confidence state; and
- bounded option labels for select and radio controls.

The model deliberately does not include the current control value. DOM IDs,
provider payloads, cookies, tokens, full HTML, and arbitrary page metadata do
not become canonical form data.

## 3. Control types

M11 represents text, email, phone, URL, textarea, select, radio group,
checkbox, file, date, and number controls. Hidden and action controls are
omitted. Other input types remain explicit as `UNSUPPORTED`.

Radio inputs sharing a native name are represented as one question with bounded
options. Select and radio option labels are page-provided untrusted text; their
current selected values are not read.

## 4. Initial canonical keys

M11 deterministically recognizes initial keys for:

- first, last, and full name;
- email and phone;
- address lines, city, region, postal code, and country;
- LinkedIn, GitHub, and portfolio URLs;
- school, degree, and field of study;
- current company and current title; and
- resume and cover-letter files.

Browser `autocomplete` metadata has priority when it maps exactly. Explicit
control types such as email and phone are next. Bounded label/name heuristics
may produce medium-confidence mappings. Everything else keeps a null canonical
key and `UNKNOWN` support.

M11 does not classify work authorization, sponsorship, compensation,
demographic disclosure, disability, veteran status, legal attestation,
signature, or other sensitive/consequential questions. Those remain unknown
until M12 defines deterministic Answer Engine policy.

## 5. Support and confidence

- `SUPPORTED`: the canonical key is recognized by deterministic rules.
- `UNKNOWN`: the control can be described, but its meaning is not safely known.
- `UNSUPPORTED`: the control shape is outside the current normalized set.

Confidence is `HIGH`, `MEDIUM`, or `LOW`. Confidence describes mapping quality;
it is not an authorization to answer or fill. M12 policy remains authoritative,
and M13 executes only approved `FILL` decisions after user action.

## 6. Adapter boundary

Adapter selection order is Greenhouse, Lever, Ashby, Workday, then generic. Specific
adapters contain only their host and form-location knowledge. All adapters reuse
the same normalizer, so provider DOM does not leak into the canonical model.

The ATS adapters are fixture-validated formation boundaries, not a claim of
universal or permanent compatibility. Provider DOM changes may require an
isolated adapter update. Workday was not an M11 target; a fixture-validated
Workday adapter was added later (Phase R). It locates Workday's formless apply
step by `data-automation-id` and reuses the shared normalization, which also
reads `data-automation-id` as a field hint. Workday's custom button/listbox
dropdowns remain unsupported.

Adapters return form-like containers (`HTMLElement`), not only `<form>`
elements. When a page has no `<form>` at all, the generic adapter treats the
smallest element holding all fields as one form, but only when there are at
least three fields, at least one personal field (file upload, email, phone, or
a name/email/tel `autocomplete`), and an English or Chinese application signal.
This targets formless single-page ATSs without host-specific guesses.

## 7. Untrusted input and limits

All page labels, options, attributes, and instructions are untrusted data. They
cannot change extension policy, request credentials, invoke API operations, or
turn an unknown field into a known answer. React renders only aggregate counts
in the popup.

Inspection is bounded to 10 forms, 200 controls per form, 100 options per
field, and 500 characters per extracted text item. The extension retains its
M10 active-tab-only inspection, exact message validation, background-only
credentials, and no persistent page bridge.
