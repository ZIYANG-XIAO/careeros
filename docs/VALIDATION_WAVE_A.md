# Wave A Jobs Product Validation

Date: 2026-09-23

## Scope

This gate validates the completed M8–M9 Jobs product on a signed-in local
account. It covers the Jobs-first shell, canonical source presentation, direct
application path, save behavior, and optional Job Intelligence. It does not
validate a production job feed, extension behavior, autofill, or Application
Memory.

## Representative fixture

The local M9 seed adapter ingested three clearly labeled demo jobs into the
canonical Job model:

- an available remote job with an application URL;
- an available location-specific job with an application URL; and
- a job with unknown availability and no application URL.

All three use `Demo source`, unknown freshness, stable external identities, and
grounded structured requirements. They do not imply live or production source
coverage.

## Results

| Check | Result |
| --- | --- |
| Jobs is the primary signed-in landing surface | Pass |
| Jobs can be browsed as useful cards rather than a raw data table | Pass |
| Title/company search and location filtering work together | Pass |
| A job can be saved and found in the Saved Jobs view | Pass |
| Job detail presents company, title, location, requirements, and description | Pass |
| Source, availability, and unknown freshness remain explicit | Pass |
| A missing application URL is presented honestly | Pass |
| Apply is available without running Job Intelligence | Pass |
| Job Intelligence is labeled as optional enhancement | Pass |
| Applications navigation describes its placeholder state honestly | Pass |
| Manual capture remains available for jobs found elsewhere | Pass |
| Canonical source ingestion is retry-safe | Pass (automated coverage) |
| Ownership boundaries remain enforced | Pass (automated coverage) |

## Focused refinement

The detail-page empty state referred to domain evidence as `Profile evidence`.
It now uses `Career Brain evidence`; `Profile` remains the navigation label for
the user-facing management surface.

## Gate decision

Wave A passes representative product and engineering validation. The current
experience provides a clear path from finding a job to inspecting, saving, and
applying, while keeping Job Intelligence optional.

This is not a broad usability study and does not establish production source
quality or market coverage. Those limitations do not authorize production
ingestion work and do not change the next approved milestone: M10, Extension
Foundation and Secure API Boundary.
