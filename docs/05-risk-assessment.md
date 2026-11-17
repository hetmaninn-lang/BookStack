# Risk assessment

> **Draft for review.** The risks come from the discovery recorded in
> [01-product-overview.md](01-product-overview.md). The likelihood and impact ratings are proposals
> and have not been confirmed by the QA lead.

## Scope

In scope: authentication, roles and permissions, pages, REST API.
Out of scope for this portfolio: shelves, attachments beyond access checks, search relevance,
import/export correctness, webhooks, theming, performance and load.

## Method

Each risk is rated on two three-point scales and scored as likelihood × impact.

| | 1 | 2 | 3 |
| --- | --- | --- | --- |
| **Likelihood** | Simple, single code path | Several interacting conditions | Many combinations or configuration-dependent |
| **Impact** | Inconvenience, easy workaround | Wrong or lost content for some users | Unauthorised access, privilege gain or unrecoverable loss |

Priority: **High** 6–9, **Medium** 3–4, **Low** 1–2.

There is no defect history for this instance, so likelihood is estimated from how many conditions
interact, not from past failures. Basis column: **Observed** means the behaviour behind the risk was
seen on the test instance; **Stated** means the application's own text says so; **Assumed** means
it has not been examined yet.

## Access control

| ID | Risk | Basis | L | I | Score | Planned response |
| --- | --- | --- | --- | --- | --- | --- |
| AC-01 | A restricted role changes content by sending the request directly, although the UI hides the action | Assumed — only page loads were probed | 2 | 3 | 6 High | Automate direct create/edit/delete requests as Viewer and Editor, UI and API |
| AC-02 | Content-level permission overrides are not honoured, so a restricted book, chapter or page is still reachable | Stated — overrides exist; not yet exercised | 3 | 3 | 9 High | Decision table over role permission × override × inheritance; automate the core rows |
| AC-03 | Restricted content leaks through a secondary route: search results, revisions, exports, tags, activity on user profiles, API listings | Observed — Viewers reach revisions, exports and other users' profiles | 3 | 3 | 9 High | One restricted fixture, checked through every listing route |
| AC-04 | "Own" scope is evaluated wrongly, letting a user edit or delete content owned by someone else | Stated — Own/All scopes exist | 2 | 3 | 6 High | Custom role with Own-only permissions; automate owner vs non-owner |
| AC-05 | A user holding several roles receives more than the union of those roles, or loses a restriction | Stated — privileges stack | 2 | 3 | 6 High | Pairwise role combinations, manual first |
| AC-06 | A user gains administrative power through "manage users", "manage roles" or "manage settings" | Stated — the app warns about exactly this | 2 | 3 | 6 High | Verify each permission in isolation; document as accepted product behaviour where intended |
| AC-07 | Uploaded images are readable without logging in | Stated — "all images are public" | 3 | 2 | 6 High | Confirm actual behaviour with and without the higher-security option; report as a documented limitation, not a defect |
| AC-08 | An Editor deletes a book that others depend on | Observed — delete is available to Editors by default | 2 | 2 | 4 Medium | Check recycle-bin recovery and who can restore |

## Authentication

| ID | Risk | Basis | L | I | Score | Planned response |
| --- | --- | --- | --- | --- | --- | --- |
| AU-01 | Repeated failed logins are not throttled | Observed — an account is locked for about a minute after 5 failures, even for the correct password; failures spread across different accounts from one client were not limited (15 tried) | 2 | 3 | 6 High | Lockout automated. Open question: is the missing per-client limit (password spraying) in scope? |
| AU-02 | A session stays valid after logout, password change or account deactivation | Assumed | 2 | 3 | 6 High | Automate: replay the old session cookie after each event |
| AU-03 | A role that requires multi-factor authentication can be used without completing it | Stated — per-role MFA option | 2 | 3 | 6 High | Manual test of every entry point, including the API |
| AU-04 | Self-registration grants an unintended role, or the domain restriction is bypassed by changing email afterwards | Stated — default role list includes Admin; the app notes email can be changed later | 2 | 3 | 6 High | Configuration review plus manual test; confirmation emails are captured by Mailpit |
| AU-05 | Password reset can be abused or reveals which emails are registered | Observed — same message for registered and unknown emails, no email sent to unknown ones, links are single-use, 10 reset requests per minute per client | 1 | 2 | 2 Low | Automated: full reset flow, link reuse, unknown email, rate limit. Rating lowered from 4 because every control was observed working |

## Pages

| ID | Risk | Basis | L | I | Score | Planned response |
| --- | --- | --- | --- | --- | --- | --- |
| PG-01 | Script injected through page content runs for other users | Assumed — editors author rich content | 2 | 3 | 6 High | Payload set through both editors and the API; automate the regression set |
| PG-02 | Two people editing the same page overwrite each other's work | Assumed — drafts exist (observed) | 3 | 2 | 6 High | Manual two-session test, then decide on automation |
| PG-03 | Restoring a revision restores the wrong content, or revisions expose content after the page is restricted | Observed — revisions visible to Viewers | 2 | 2 | 4 Medium | Manual; overlaps AC-03 |
| PG-04 | Moving or copying a page into another book leaves it with the wrong permissions | Assumed | 2 | 3 | 6 High | Covered by the AC-02 decision table |
| PG-05 | Switching between the editors loses or alters content | Assumed — "change page editor" is a permission | 2 | 2 | 4 Medium | Exploratory session |

## REST API

| ID | Risk | Basis | L | I | Score | Planned response |
| --- | --- | --- | --- | --- | --- | --- |
| API-01 | The API allows something the UI forbids for the same user | Observed — both exist; parity not yet compared | 2 | 3 | 6 High | Run the access-control checks through both interfaces |
| API-02 | A token keeps working after it expires, is deleted, or its owner loses the API permission | Assumed | 2 | 3 | 6 High | Automate all three |
| API-03 | Invalid input causes a server error or a partial write | Assumed | 2 | 2 | 4 Medium | Negative tests on create/update for pages and books |
| API-04 | Requests are not rate limited | Assumed | 2 | 2 | 4 Medium | One exploratory check; out of scope beyond that |

## Risks to the testing itself

| ID | Risk | Effect | Response |
| --- | --- | --- | --- |
| T-01 | ~~The test environment has no mail server~~ | — | **Resolved:** Mailpit captures all outgoing mail; tests read it through its API |
| T-02 | Only default configuration, one browser and one BookStack version are covered | Findings may not hold for other setups, e.g. public access enabled | State the tested configuration in every report |
| T-03 | Test setup creates the API token through the UI | A defect in that screen blocks every API test | Accept; the failure is loud and immediate |
| T-04 | Denied UI requests answer with a redirect and status 200 | A check that looks only at the status passes when access control is broken | Assert on the final URL and on absence of the content |
| T-05 | Login and password-reset rate limits are shared by every test running from one machine | Reruns within a minute, or parallel tests, fail with 429 for reasons unrelated to the feature | Reset tests run in a fixed order with the rate-limit test last; test setup clears the counters on the local Docker instance. Against any other environment, set `RESET_RATE_LIMITS=false` and allow a minute between runs |

## Open questions for the QA lead

1. Are the ratings right? In particular AC-07 (documented behaviour) and the lowered AU-05.
2. ~~Should email flows be in scope?~~ Decided: in scope; Mailpit added.
3. Is "public access enabled" a second configuration to test, or explicitly out of scope?
4. AU-01: login failures spread across many accounts from one client are not throttled. Is that a
   finding to report, or accepted behaviour left to infrastructure (reverse proxy, WAF)?
