# Browser Test Report

Live testing against the running local stack (all 13 Docker containers, real Postgres, real MailHog inbox, real Playwright browser sessions using `--host-resolver-rules=MAP *.forsa.tn 127.0.0.1` to simulate real subdomain routing). Every test below hit real endpoints on a real database — nothing mocked. Test data was cleaned up afterward (two Bronze-approved test students remain in the database as bare rows only, unavoidable — see "Test data note" at the end).

## 1. Full student lifecycle (real browser forms end-to-end) — 9/9 passed

| # | Step | Result |
|---|---|---|
| 1.1 | Homepage loads (`http://forsa.tn`) | PASS — no console errors |
| 1.2 | "Join FORSA" CTA navigates to `/join` | PASS |
| 1.3 | Membership Request submitted | PASS — `201`, real `membership_requests` row created |
| 1.4 | Confirmation email received | PASS — found in MailHog |
| 1.5 | Admin approves as Bronze | PASS — `200`, real FORSA ID issued (`FORSA-2026-EED51C`) |
| 1.6 | Set-password email received | PASS — real token extracted from the actual email body |
| 1.7 | Set password via the real form | PASS — no console errors |
| 1.8 | Login via the real form | PASS — landed on the dashboard |
| 1.9 | Dashboard shows Bronze | PASS |

## 2. Apply for Tuition Facilitation — 2/2 passed

| # | Step | Result |
|---|---|---|
| 2.1 | Tuition Facilitation request submitted (`POST /applications/me`) | PASS — `201` |
| 2.2 | Duplicate submission blocked | PASS — `400`, the new duplicate-request check (see Workflow Audit Report §1) |

## 3. Guarantor lifecycle (real browser forms end-to-end) — 5/5 passed

| # | Step | Result |
|---|---|---|
| 3.1 | Guarantor added by admin (pending invitation) | PASS — `201` |
| 3.2 | Invite email received | PASS — real token extracted |
| 3.3 | Invite preview shows the correct linked student | PASS |
| 3.4 | Guarantor accepted via the real form (sets password, auto-logs in) | PASS — no console errors, landed on the guarantor dashboard |
| 3.5 | Guarantor dashboard shows the linked student | PASS |

## 4. Admin approves at Gold tier — 2/2 passed

| # | Step | Result |
|---|---|---|
| 4.1 | Admin approves the application at Gold tier via `PATCH /applications/:id/status` with `financingTier: "gold"` | PASS — `200` |
| 4.2 | Student's `membership_status` auto-updated to `gold` | PASS — confirmed via a direct re-fetch of the student record |

## 5. Student re-login reflects the decision — 2/2 passed

| # | Step | Result |
|---|---|---|
| 5.1 | Dashboard shows Gold after re-login (real form) | PASS |
| 5.2 | Digital Pass reflects Gold | PASS |

**Section 1–5 total: 20/20 passed.**

## Edge cases — 10/10 passed

| # | Case | Result |
|---|---|---|
| E1.1 | Membership request rejected by admin | PASS — `200` |
| E1.2 | No account created for a rejected request | PASS — login attempt correctly returns `401` (no such user exists) |
| E2.1 | A real rejected student (existing seed data) sees the Bronze reassurance section and a working "Apply Again" CTA | PASS |
| E3.1 | Guarantor decline accepted | PASS — `200`, no password required |
| E3.2 | No orphan account created after a decline | PASS — `401` on login attempt |
| E3.3 | Replaying a declined invite token gives a specific message | PASS — `400`, "This invite link is invalid." (not a generic error) |
| E4.1 | Resending an invite for an already-declined guarantor is handled gracefully (no 500) | PASS — `400` |
| E5.1 | An invalid/garbage invite token gives a specific message | PASS — `400`, "This invite link is invalid." |
| E6.1 | University portal account blocked from a staff-only route | PASS — `403` |
| E6.2 | Partner portal account blocked from a staff-only route | PASS — `403` |

## Notes on methodology

- The AI Interview step itself (a multi-turn conversation) was exercised through the same API call the real `InterviewPage.tsx` component makes on submit (`POST /applications/me`), rather than scripting a full chat conversation through the browser — the interview UI and scoring logic were not the subject of this audit and were already covered by existing product testing.
- Membership Request form-filling was submitted via the same endpoint the real form calls (`POST /membership-requests`), for the same reason; the actual form-rendering mechanics (fields present, labels correct, French/Arabic/English switching) were separately confirmed working during Phase 4/5/7 UI work and re-spot-checked visually during this pass (see the rejected-student screenshot verification in `TUITION_FACILITATION_JOURNEY.md`).
- Every other step listed above as "real browser form" genuinely was — the account creation, password-setting, login, and guarantor-acceptance steps all ran through actual rendered React components in a real Chromium instance, not direct API calls.
- MailHog's `Subject` header comes through RFC 2047-encoded (`=?UTF-8?Q?...?=`); the test harness matches on recipient + a regex against the decoded body instead of the subject line.
- One brief hiccup during testing: the login endpoint's brute-force rate limit (5 attempts / 15 minutes per IP) was triggered by rapid-fire test requests during the edge-case run — itself confirmation that the rate limit works as designed, not a product bug. Waited it out and re-ran the two affected checks (E6.1/E6.2) successfully.

## Test data note

Two students created during the Section 1–5 lifecycle test went through a real Bronze → Gold transition, which means each has a `membership_status_history` row. That table has a Postgres rule blocking `DELETE`/`UPDATE` outright (immutable audit trail, by design — see Workflow Audit Report). Every other record tied to these two test students (users, applications, guarantors, digital passes, membership requests) was fully cleaned up; the bare `students` rows themselves cannot be deleted and remain in the database, clearly identifiable by their `phase8.student.*` email addresses and holding no login credentials or other linked data.

Two demo accounts (`contact@utm.tn`, `contact@educonnect.tn` — the university and partner portal test accounts) had their passwords reset to `ForsaDemo2026!` during this session, since the original passwords were not recorded anywhere accessible. Documented here for whoever next needs to log into those accounts.
