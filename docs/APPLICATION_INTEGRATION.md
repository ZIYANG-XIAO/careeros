# CareerOS M15 Application Integration Contract

> Status: Implemented Web and extension integration
> Last Updated: 2026-09-25

## 1. Purpose and boundary

M15 connects Jobs, the browser assistant, and durable Application Memory. It
does not automate final submission. The user submits on the external site and
then explicitly confirms that CareerOS should record the application.

## 2. CareerOS Job path

From Job detail, the user may select an exact Resume Version and choose **Start
and track application**. CareerOS first creates an idempotent `PREPARING`
Application with a stable Job/context snapshot. Only after that succeeds does
the UI present the external application link.

If preparation cannot be recorded, the external link remains available and the
UI explains that the user can recover through **Mark as applied**.

On the external page, the extension matches the current URL against owned
Application summaries. Query strings and fragments do not affect exact matching.
One recently created `PREPARING` Application may be shown as a reviewable
fallback after a redirect, but it is never associated without an additional
user choice.

## 3. External job path

An application page does not need a CareerOS Job or prior analysis. The
extension captures only the active page URL/title/host as untrusted suggestions.
The user reviews or corrects company and role, optionally selects the Resume
Version actually used, submits the external form themselves, and then chooses
**I submitted · Record application**.

CareerOS never guesses a Resume Version for an unmatched external page. No Job
Intelligence analysis is required.

## 4. Submission recording

For an existing `PREPARING` Application, the submission operation can:

- preserve a previously unset exact owned Resume Version;
- append ordered, immutable, explicitly confirmed standard/non-sensitive answer
  history;
- set `applied_at` once; and
- advance `PREPARING` to `APPLIED` without regressing a later status.

For an unmatched page, the same user action creates an external `APPLIED`
Application directly. Both paths require UUID idempotency keys. Repeated or
delayed retries do not create duplicate Applications or duplicate answer rows.

Only standard, non-sensitive values that CareerOS actually filled are eligible
for answer history. Suggestions, unanswered fields, user-entered sensitive
values, raw forms, and page content are not persisted.

## 5. Applications Web experience

The Web surface provides:

- owner-scoped list and status filtering;
- company, role, source, status, applied date, and exact Resume Version display;
- detail with retained answer history;
- retry-safe status updates; and
- manual **Mark as applied** recovery for unsupported detection or applications
  completed outside CareerOS.

## 6. Trust and recovery

API credentials and Application operations stay in the extension background.
The content script cannot request or receive Application Memory, resume options,
or credentials. The external page never receives CareerOS domain data.

Partial failures remain recoverable: forms are never submitted by CareerOS,
tracking failures do not block the external URL, recording can be retried, and
the Web manual path remains available.
