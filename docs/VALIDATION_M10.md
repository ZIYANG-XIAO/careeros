# M10 Extension Foundation Validation

> Status: Passed
> Validated: 2026-09-24

## Scope

This validation covers M10 only: the Manifest V3 extension foundation, secure
authentication/API boundary, active-tab application-page detection, and honest
supported/unsupported UI. It does not validate normalized form fields, ATS
adapters, the Answer Engine, autofill, or submission.

## Automated verification

- Extension unit tests pass, including token isolation, unauthenticated and 401
  behavior, exact message parsing, detection heuristics, and native `fetch`
  receiver safety in a service worker.
- Extension type checking and formatting pass.
- The built extension passes its security validation: no
  `<all_urls>`, declarative content scripts, `externally_connectable`, content
  bundle credentials, authorization headers, Clerk code, or secret keys.
- The checked-in public development key produces the stable extension ID
  `ibihlmjmbfjegkljfjihhakppeagbpkf`.

## Representative Chrome validation

Validated with the unpacked build in Chrome against the local Web, API, and
fixture servers:

1. A user already signed into CareerOS Web opened the extension on the local
   external-application fixture.
2. Clerk Sync Host resolved the signed-in session without collecting credentials
   in the extension.
3. The background service worker called protected `GET /me`; the API returned
   `200 OK`, proving the authenticated backend boundary was reached.
4. The popup displayed `Connected to CareerOS` and `Application page detected`.
5. The same extension displayed `No application detected` on the API health page.
6. On `chrome://extensions`, the popup stayed authenticated and instructed the
   user to open a normal web page rather than pretending inspection succeeded.
7. The external fixture had no CareerOS Job or Job Analysis, so detection did not
   depend on CareerOS discovery.

## Security and ownership observations

- Session tokens remain in the background worker and are not returned to the
  popup, content script, or page.
- The content script can request only page inspection; privileged popup messages
  from a sender with a page tab are rejected.
- The extension injects the detector only into the active HTTP(S) tab after the
  user opens the popup.
- The protected API continues to derive ownership from the verified Clerk token;
  the extension does not supply or select a user identifier.
- M10 performs no form write, upload, final submission, persistence, or database
  migration.

## Defect found and repaired during validation

The initial browser run revealed that the API client retained native `fetch` as
an object property and invoked it with the class instance as its receiver.
Chrome rejected that call with `Illegal invocation` before `/me` was reached.
The client now invokes `fetch` through a receiver-safe wrapper, and a regression
test reproduces the native receiver constraint. The repaired browser run reached
`/me` successfully.

## Known limitations

- Detection is intentionally heuristic and not universal.
- M10 does not inspect or normalize form fields and has no ATS-specific adapter.
- No answer resolution, autofill, resume upload, review workflow, Application
  Memory, or submission behavior exists yet.
- Local authentication requires Clerk Native API enablement, the stable extension
  origin in Clerk `allowed_origins`, and the documented public extension values.
