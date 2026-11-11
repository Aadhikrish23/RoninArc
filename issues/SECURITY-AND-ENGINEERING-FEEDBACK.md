# RoninArc — Security & Engineering Feedback

**Review date:** 11 November 2026  
**Review type:** Static source-code review  
**Scope:** Backend, Electron desktop, frontend, mobile, AI, cloud sync, tests, and release configuration  
**Status:** Findings require remediation and verification

> This document records findings from a static review of the repository. It is not a penetration-test certificate or a guarantee that every line of code has been reviewed. No automated tests, packaged-build tests, or live exploit tests were executed as part of this review. Risk statements described as potential or conditional must be validated in the running application.

## 1. Executive summary

RoninArc has a meaningful foundation: the project separates major application layers, includes a substantial Playwright test suite, and already uses several sound security practices. However, multiple trust-boundary and release-hardening issues should be addressed before a public release.

**Indicative engineering readiness score: 60/100.** This is a reviewer's prioritization aid, not a formal security rating.

| Intended use | Indicative readiness | Assessment |
|---|---:|---|
| Personal use on a trusted PC | 72/100 | Usable with caution |
| Small private beta | 55/100 | Fix high-priority findings first |
| Public release | 40/100 | Not ready |
| Commercial deployment | 25/100 | Not ready |

### Highest-priority concerns

1. Remove OAuth token/credential logging and rotate any exposed Epic credentials.
2. Do not rely on an enrollment key embedded in a distributed desktop installer.
3. Bind the embedded backend explicitly to loopback and add local authentication throttling.
4. Validate ownership of every referenced document accepted through cloud sync.
5. Harden Electron IPC, URL navigation, and executable launching.
6. Correct account uniqueness and refresh-token concurrency behavior.

## 2. Findings and recommended actions

Severity labels are prioritization guidance. “High” indicates a likely security or data-integrity concern based on the reviewed code path; items marked “needs validation” should not be treated as a proven exploit.

### RA-001 — Epic OAuth secrets and token responses may be exposed

**Priority:** Critical  
**Files:**
- `backend/src/modules/providers/epic/epicOAuthService.ts`
- `backend/src/modules/providers/epic/epicApiService.ts`
- `backend/src/shared/logging/logger.ts`
- `backend/src/instrument.ts`
- `desktop/main.js`

**Observation:** The reviewed Epic OAuth implementation contains a client-secret value in source and logs an authentication response object. That response may contain access and refresh tokens. The console instrumentation formats log arguments, which can undermine structured-field redaction when secrets are embedded in a formatted string. The desktop main process also captures backend stdout in a startup log.

**Impact:** Anyone who can access the repository or relevant persisted logs may be able to obtain credentials or user tokens. A client secret committed to a public repository must be considered compromised.

**Recommended remediation:**
- Remove all token, secret, authorization-code, and full authentication-response logging.
- Log only safe metadata, such as provider name, operation, status code, and a non-sensitive correlation ID.
- Rotate/revoke the Epic client secret if it was real and active; review provider configuration and access.
- Revoke affected user tokens and require provider reconnection if token values were persisted in logs.
- Add secret scanning to CI and review repository history and release logs for leaked values.

**Verification:** Search source, tests, build output, desktop logs, and cloud logs for token/secret values. Confirm that failed and successful OAuth flows never emit credentials.

### RA-002 — Desktop enrollment key is distributed with the application

**Priority:** Critical  
**Files:**
- `desktop/package.json`
- `desktop/services/keygate.js`
- `desktop/keygate.example.json`
- `docs/beta/RELEASING.md`

**Observation:** The packaged desktop files include Keygate configuration, and the client uses an enrollment key to request an installation token. A key shipped to end-user machines can be extracted from the installer or installed files.

**Impact:** The enrollment key cannot be treated as confidential once distributed. Depending on the server-side worker's policy, extraction may permit unauthorized enrollment or resource abuse. The server-side worker was not part of this repository review, so the exact exploitability is not established here.

**Recommended remediation:**
- Treat every distributed enrollment key as public, not as a secret.
- Replace shared permanent enrollment secrets with short-lived, single-use, scoped enrollment grants.
- Enforce server-side rate limits, quotas, device limits, expiry, and revocation.
- Monitor abnormal enrollment patterns and rotate any key already shipped.
- Keep privileged server credentials exclusively on the server.

**Verification:** Extract the packaged installer and confirm that no reusable privileged secret is present. Test enrollment replay, expiry, brute-force resistance, and revocation against the worker.

### RA-003 — Embedded backend may listen on non-loopback interfaces

**Priority:** High  
**Files:**
- `backend/src/server.ts`
- `backend/src/app.ts`
- `backend/src/shared/rateLimit.ts`

**Observation:** The embedded backend calls `app.listen(PORT)` without explicitly specifying a host. In Node.js this commonly binds to an unspecified interface. Embedded CORS configuration reflects request origins, and the local embedded mode does not appear to mount the same login/register rate limits used in cloud mode. The embedded MongoDB process is configured for loopback, but without database authentication.

**Impact:** Depending on host firewall and runtime conditions, another device on the local network may be able to reach the desktop backend. Missing local login throttling increases the impact of exposed authentication endpoints. Local processes on the same machine may also connect to the unauthenticated embedded database port.

**Recommended remediation:**
- Bind the embedded backend explicitly to `127.0.0.1` (and ensure IPv6 behavior is intentional).
- Restrict embedded CORS to the exact trusted desktop origin(s); do not reflect arbitrary origins.
- Apply authentication rate limits in embedded mode as well as cloud mode.
- Consider MongoDB authentication or a protected local transport/port strategy.
- Keep cloud and embedded security configuration explicit and separately tested.

**Verification:** From another LAN device, verify the embedded service is unreachable. Confirm untrusted origins are rejected and repeated local login attempts are throttled.

### RA-004 — Cloud sync does not validate ownership of nested references

**Priority:** High  
**Files:**
- `backend/src/modules/sync/cloudSync.ts`
- `backend/src/modules/sync/syncCollections.ts`
- `backend/src/modules/collection/collectionService.ts`
- `backend/src/modules/collection/collectionController.ts`

**Observation:** Sync forces the top-level `userId` to the authenticated owner and checks direct document-ID collisions. However, the reviewed path does not consistently validate the ownership of referenced IDs inside accepted documents. Relevant references include collection `gameIds`, review/note/play-session `gameId`, and activity `gameId`/`collectionId`. Collection retrieval populates `gameIds` without a visible owner constraint.

**Impact:** A malicious or malformed sync payload may be able to create cross-account references. If a later query populates those references without ownership filtering, data belonging to another account may be exposed. This is a code-level risk requiring a targeted two-account test to confirm end-to-end exploitability.

**Recommended remediation:**
- Validate every referenced game, collection, and other foreign document against the authenticated user's ownership before accepting a sync record.
- Reject or safely discard invalid references; do not silently attach foreign objects.
- Make population and retrieval queries ownership-aware as defense in depth.
- Add two-account integration tests for every collection type and nested reference.
- Test both push and subsequent pull/read paths.

**Verification:** Create accounts A and B. Attempt to sync B's game and collection IDs through A's documents. Confirm the write is rejected and no foreign metadata is returned by any API.

### RA-005 — Electron IPC handlers need sender and argument validation

**Priority:** High  
**Files:**
- `desktop/main.js`
- `desktop/preload.js`

**Observation:** The BrowserWindow uses `contextIsolation: true` and `nodeIntegration: false`, and the preload bridge is relatively narrow. These are good foundations. However, main-process IPC handlers do not visibly enforce a strict sender/frame allowlist for every privileged operation. The game-launch handler accepts a renderer-supplied executable path and invokes `cmd.exe /c start` with verbatim arguments. OAuth navigation also accepts a renderer-provided URL without a clearly enforced exact provider-host allowlist.

**Impact:** If renderer content is compromised, insufficient IPC validation may allow privileged actions. Passing untrusted executable paths through a shell command creates a potential command-injection boundary. Unrestricted login URL navigation may enable phishing or unsafe navigation. These are potential attack paths; exploitation was not dynamically demonstrated.

**Recommended remediation:**
- Validate IPC sender identity, frame, and origin for every privileged handler.
- Validate argument types, lengths, allowed schemes, and allowed paths.
- Launch executables with a direct process API and structured arguments rather than shell command construction.
- Enforce exact allowlisted OAuth provider hosts and expected paths.
- Prevent unexpected main-window navigation and external-window creation.
- Keep privileged APIs minimal and expose only required operations through preload.

**Verification:** Add tests for forged IPC messages, unexpected frames, malformed paths, shell metacharacters, arbitrary URLs, and disallowed navigation.

### RA-006 — Email uniqueness is not enforced atomically

**Priority:** High  
**Files:**
- `backend/src/modules/auth/models/User.ts`
- `backend/src/modules/auth/authService.ts`

**Observation:** Registration checks whether an email already exists before creating a user. The schema has a unique username index, but no equivalent unique index for normalized email was visible in the reviewed code.

**Impact:** Concurrent registration requests can both pass the pre-check and create multiple accounts with the same email. This can break password reset, login, and account ownership assumptions.

**Recommended remediation:**
- Normalize email consistently before storage.
- Add a unique index on the normalized email field, with an appropriate migration and duplicate cleanup plan.
- Handle MongoDB duplicate-key errors as a normal registration conflict.
- Avoid relying on an application-level pre-check for uniqueness.

**Verification:** Run concurrent registration requests using the same normalized email and verify exactly one account is created.

### RA-007 — Refresh-token rotation has a concurrency race; tokens are stored in plaintext

**Priority:** High  
**Files:**
- `backend/src/modules/auth/authService.ts`
- `backend/src/modules/auth/models/RefreshToken.ts`

**Observation:** Refresh logic appears to read/validate a token and then delete it before issuing a replacement. Two concurrent refresh requests may both pass the initial lookup. Refresh token values are stored directly in MongoDB.

**Impact:** Concurrent requests may both obtain a successful refresh path, weakening single-use rotation semantics. A database read exposure may also disclose active refresh tokens.

**Recommended remediation:**
- Atomically claim and consume a refresh token using a conditional delete/update that verifies token identity, unused state, and expiry.
- Store a cryptographic hash of refresh tokens rather than their raw values.
- Ensure token-family reuse detection and revoke the affected family/session when appropriate.
- Add concurrency tests for simultaneous refresh requests.

**Verification:** Submit the same refresh token concurrently and assert that at most one request succeeds. Confirm database records contain hashes, not raw tokens.

### RA-008 — Sync raw writes bypass full schema validation and trust client timestamps

**Priority:** High  
**Files:**
- `backend/src/modules/sync/cloudSync.ts`
- `backend/src/modules/sync/syncCollections.ts`

**Observation:** Sync uses raw replacement writes that bypass normal Mongoose validation. Existing cleanup strips some dangerous Mongo operators and forces the authenticated `userId`, which is positive, but a complete per-collection field/type allowlist was not evident. Client-provided `updatedAt` values influence conflict ordering.

**Impact:** Malformed fields or unexpected types may be persisted. A client can potentially submit a far-future timestamp for its own document, causing legitimate updates from other devices to be treated as older and rejected.

**Recommended remediation:**
- Define strict allowlists and type validators for each sync collection.
- Reject unknown fields and invalid relationships before persistence.
- Use server-controlled revisions or clamp/validate client timestamps.
- Add payload-size, document-count, and per-user sync rate limits.
- Keep conflict resolution deterministic and documented.

**Verification:** Test unknown fields, invalid types, oversized payloads, extreme future/past timestamps, and replayed sync documents across multiple devices.

### RA-009 — Game deletion and tombstone creation are not atomic

**Priority:** High  
**Files:**
- `backend/src/modules/library/libraryServices.ts`
- `backend/src/modules/sync/tombstonePlugin.ts`

**Observation:** Game deletion removes the game and related references in multiple operations. Tombstone logic reads before deletion and writes tombstones afterward.

**Impact:** A failure between operations can leave orphaned references or incomplete cleanup. Races between deletion and tombstone creation may result in missing or inconsistent sync tombstones.

**Recommended remediation:**
- Use a database transaction where deployment topology supports it.
- Otherwise use a durable cleanup/outbox workflow with idempotent retries.
- Ensure tombstone creation and delete state cannot be lost during retries or concurrent sync.
- Add failure-injection and concurrent-delete tests.

**Verification:** Force each cleanup step to fail in turn and confirm eventual consistency, correct tombstones, and no permanent orphaned references.

### RA-010 — AI confirmation parser treats ambiguous replies as approval

**Priority:** High  
**Files:**
- `backend/src/modules/ai/conversation/PendingConfirmationStore.ts`
- `backend/src/modules/ai/conversation/GameReplies.ts`
- `backend/src/modules/ai/execution/PlanRunner.ts`
- `backend/src/modules/ai/games/index.ts`

**Observation:** The positive confirmation vocabulary includes ambiguous words such as `thanks`, `ty`, `cool`, `alright`, and `fine`. Removal confirmation is wired into the plan runner, which is a positive safeguard, but a casual message could be interpreted as consent.

**Impact:** A user may unintentionally confirm a destructive game-removal action.

**Recommended remediation:**
- Require explicit affirmative intent for destructive actions.
- Prefer a specific confirmation button or a one-time confirmation token tied to the pending action.
- Treat ambiguous acknowledgements as non-confirmations and ask again.
- Add tests for “thanks”, “cool”, “fine”, “okay”, unrelated replies, negations, and explicit confirmation.

**Verification:** Confirm that only unambiguous approval or the explicit confirmation control authorizes removal.

### RA-011 — Password policy is relatively weak

**Priority:** Medium  
**Files:**
- `backend/src/modules/auth/authService.ts`
- `backend/src/modules/auth/passwordReset.ts`
- Frontend authentication forms

**Observation:** The reviewed password validation accepts a minimum length of six characters and trims password values.

**Impact:** Short passwords reduce resistance to guessing, and silently trimming passwords can create surprising authentication behavior.

**Recommended remediation:**
- Adopt a longer passphrase-friendly minimum (for example, 12 characters) with sensible maximum length and no arbitrary complexity rules.
- Do not silently trim passwords; treat the entered password consistently.
- Apply the same policy to registration and password reset.
- Consider compromised-password checks where operationally appropriate.

**Verification:** Test matching registration/reset policies and whitespace-containing passwords.

### RA-012 — Password-reset token consumption may race

**Priority:** Medium  
**File:** `backend/src/modules/auth/passwordReset.ts`

**Observation:** Token lookup/validation and marking the token as used are separate operations in the reviewed flow.

**Impact:** Concurrent reset requests may both pass validation before either marks the token consumed.

**Recommended remediation:** Atomically claim the reset token with a conditional update that checks unused state and expiry, then change the password. Add concurrent-use tests.

### RA-013 — Frontend token storage can expose credentials to renderer JavaScript

**Priority:** Medium  
**Files:**
- `frontend/src/features/auth/context/AuthContext.tsx`
- `frontend/src/shared/api/axiosInstance.ts`

**Observation:** Authentication tokens are stored in browser storage. The login flow can choose local or session storage, but the opposite store is not visibly cleared in every path, and restoration prefers local storage.

**Impact:** Renderer-side XSS can access tokens stored in web storage. In some alternate login flows, a stale token in the other store may be preferred during restoration.

**Recommended remediation:**
- Clear the unused storage location during login/logout and define a single source of truth.
- For Electron, consider keeping refresh tokens in the main process using OS-backed secure storage, with short-lived access tokens held in memory.
- Apply CSP and XSS prevention controls.

**Verification:** Test login persistence combinations, restart behavior, logout, token refresh, and storage inspection.

### RA-014 — Content Security Policy is disabled

**Priority:** Medium  
**File:** `backend/src/app.ts`

**Observation:** Helmet Content Security Policy is disabled globally in the reviewed configuration.

**Impact:** If a cross-site scripting issue exists, the absence of CSP removes an important browser defense-in-depth control.

**Recommended remediation:** Introduce an environment-appropriate CSP with explicit script, style, image, font, connect, and frame sources. Prefer nonces or hashes where inline code is required. Avoid globally disabling CSP to solve isolated development problems.

**Verification:** Validate CSP in production builds and test that required application features work without broad unsafe directives.

### RA-015 — Steam OpenID callback validation could be stricter

**Priority:** Medium  
**File:** `backend/src/modules/providers/steam/steamOpenIdService.ts`

**Observation:** The flow checks the OpenID mode and claimed-ID pattern and calls Steam's `check_authentication`. The reviewed implementation did not visibly enforce an exact expected `return_to` value or a replay cache for response nonces.

**Impact:** This is a protocol-hardening concern. The review did not establish a working account-link exploit.

**Recommended remediation:** Validate `return_to` and realm against configured callback URLs, validate nonce freshness, and reject nonce reuse. Add malformed-callback and replay tests.

### RA-016 — In-memory AI/session maps may grow or be lost on restart

**Priority:** Medium  
**Areas:** AI conversation store, recent exchanges, request queue, undo logs, pending confirmations.

**Observation:** Several per-user/session structures are held in process memory. Expired sessions may be closed without all corresponding map entries being evicted.

**Impact:** Long-running cloud processes may accumulate memory, while restarts or multiple instances may lose or disagree on pending confirmations and undo/session state.

**Recommended remediation:** Add bounded TTL eviction and memory metrics. Persist state that must survive restarts, or explicitly constrain these features to one process and document the limitation. Test multi-instance behavior.

### RA-017 — In-memory rate limiting does not coordinate across instances

**Priority:** Medium  
**File:** `backend/src/shared/rateLimit.ts`

**Observation:** Rate-limit counters are held in process memory.

**Impact:** In multi-instance deployments, each instance may independently allow requests, weakening effective limits. Configuration values such as the rate multiplier should also be validated.

**Recommended remediation:** Use a shared store such as Redis for horizontally scaled deployments, validate configuration at startup, and test limits across multiple instances.

### RA-018 — Embedded MongoDB binary integrity is not verified

**Priority:** Medium  
**File:** `desktop/scripts/fetch-mongod.js`

**Observation:** The download uses HTTPS, but a pinned checksum or signature verification step was not evident.

**Impact:** HTTPS alone does not provide an independent integrity check against compromised release metadata or upstream distribution risks.

**Recommended remediation:** Pin expected SHA-256 checksums from a trusted release source, verify before execution, and fail closed on mismatch. Prefer signed upstream artifacts when available.

### RA-019 — Windows installer is unsigned

**Priority:** Medium  
**Files:** `PRODUCT.md` and release documentation

**Observation:** Release documentation indicates that the Windows installer is unsigned.

**Impact:** Users may see SmartScreen warnings, and the release lacks publisher identity/integrity assurance provided by code signing.

**Recommended remediation:** Sign installers and relevant binaries with a protected code-signing certificate; timestamp signatures and verify signatures in release automation.

### RA-020 — Continuous integration workflow is missing

**Priority:** Medium  
**Location:** Repository root

**Observation:** No `.github/workflows/` directory was found in the reviewed `main` branch tree.

**Impact:** Build, lint, test, and security checks may not run consistently on every change.

**Recommended remediation:** Add GitHub Actions workflows for backend/frontend builds, lint/type checks, API and UI Playwright suites, dependency auditing, secret scanning, and packaged Windows smoke tests. Protect the default branch with required checks.

### RA-021 — Render free-tier behavior is unsuitable for dependable production

**Priority:** Low / operational  
**Files:** `render.yaml`, `docs/cloud/DEPLOY.md`

**Observation:** Deployment documentation describes free-tier sleep/cold-start behavior.

**Impact:** This can produce slow first requests and unreliable availability for users who expect an always-on service.

**Recommended remediation:** Use an always-on deployment plan for production, configure health checks and monitoring, and document recovery and backup procedures.

## 3. Positive engineering observations

The following are strengths to preserve while addressing the findings:

- Electron BrowserWindow uses `contextIsolation: true` and `nodeIntegration: false`, with a comparatively narrow preload bridge.
- Embedded MongoDB is configured to bind to loopback.
- Per-install JWT secrets are generated.
- Access tokens are short-lived; bcrypt is used; password-reset tokens are hashed and have expiry/single-use intent.
- Forgot-password responses are generic, reducing account enumeration.
- Password changes revoke refresh tokens.
- Sync forces the authenticated top-level `userId`, rejects direct cross-account document-ID collisions, strips local-only fields, and includes natural-key merge/tombstone/conflict handling.
- Normal collection service paths validate game and collection ownership.
- AI planning and execution are separated; parameter checks, cycle detection, confirmation before removal, undo support, and per-user queueing exist.
- Mobile uses Expo SecureStore, coordinates concurrent refresh calls, and clears query caches when accounts change.
- The repository contains 25 API Playwright spec files and 10 UI Playwright spec files. The README reports approximately 630 API tests.
- Test setup includes isolated MongoDB and provider/service mocking for multiple application paths.

These strengths are useful foundations, but they do not cancel the findings above.

## 4. Recommended remediation roadmap

### Phase 0 — Immediate containment

- [ ] Remove Epic token/secret logging.
- [ ] Rotate any real Epic client secret exposed in source or logs.
- [ ] Revoke affected provider tokens if they may have been persisted.
- [ ] Treat packaged Keygate enrollment credentials as public; rotate and constrain enrollment.

### Phase 1 — Security boundaries

- [ ] Bind the embedded backend to loopback explicitly.
- [ ] Restrict embedded CORS and apply local authentication throttling.
- [ ] Validate ownership of every nested reference accepted by cloud sync.
- [ ] Harden Electron IPC sender validation, executable launching, and OAuth navigation.
- [ ] Make destructive AI confirmations unambiguous.

### Phase 2 — Data and authentication integrity

- [ ] Add normalized unique email index and duplicate-key handling.
- [ ] Make refresh-token rotation atomic and store token hashes.
- [ ] Make password-reset consumption atomic.
- [ ] Add strict per-collection sync schema validation and server-controlled conflict revisions.
- [ ] Make game deletion/tombstone workflows transactional or durably retryable.

### Phase 3 — Defense in depth and operations

- [ ] Introduce CSP.
- [ ] Harden Steam OpenID callback/nonce validation.
- [ ] Bound and/or persist in-memory AI/session state.
- [ ] Use shared rate-limit storage for multi-instance deployment.
- [ ] Verify downloaded MongoDB binary checksums/signatures.
- [ ] Sign Windows installers.
- [ ] Add CI workflows and dependency/secret scanning.

### Phase 4 — Verification and release gate

- [ ] Run the complete API test suite.
- [ ] Run the complete UI Playwright suite.
- [ ] Add two-account sync isolation tests for every referenced entity type.
- [ ] Add concurrency tests for registration, refresh, and password reset.
- [ ] Add Electron IPC and game-launch security tests.
- [ ] Build and smoke-test the packaged Windows installer.
- [ ] Test clean install, upgrade, uninstall, and recovery paths.
- [ ] Perform a dynamic security review against a staging deployment.
- [ ] Review logs and release artifacts for secrets before publishing.

## 5. Release acceptance criteria

RoninArc should not be considered ready for public release until:

1. No active credentials, tokens, or reusable privileged enrollment secrets are present in source or distributed artifacts.
2. Embedded services are not reachable from unintended network interfaces.
3. Cross-account references are rejected and cannot leak through populate/read endpoints.
4. Privileged Electron operations validate their caller and arguments.
5. Registration and token lifecycle operations are race-safe.
6. Sync validates data shape, ownership, and conflict metadata.
7. Destructive AI actions require explicit confirmation.
8. CI runs required builds and tests on every change.
9. Packaged application smoke tests pass on supported Windows environments.
10. Release artifacts are integrity-verified and appropriately signed.

## 6. Review limitations

- This was a static source review, not a live penetration test.
- No API/UI tests were executed during this review.
- No packaged installer was extracted or dynamically tested.
- The Keygate server-side worker and external provider infrastructure were not reviewed.
- Potential exploit paths are identified as risks, not represented as successfully exploited.
- File paths and observations should be rechecked against the exact commit being remediated.

**Final assessment:** Preserve the existing architecture, but prioritize trust boundaries, credential handling, sync ownership validation, Electron privilege separation, and authentication concurrency before expanding features or publishing a public release.
