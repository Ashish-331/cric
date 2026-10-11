# Cric — Master Implementation Prompt for a Shared Cricket Platform

## 0. Read this first: what you are building

You are the implementation agent for https://github.com/Ashish-331/cric.git.

Build a shared, account-based cricket platform inspired by the workflows shown in the user's CricHeroes screenshots. Do not build a tally application that merely adds runs on one device.

**The defining requirement:** one authorised scorer records a match; every participating player can sign in on their own phone and see their own scorecard, match history, and career statistics. Spectators can follow permitted live matches. Captains manage teams and tournament entries. Organisers approve entries, schedule fixtures, and approve results.

The existing Expo/React Native application is the starting point. Preserve useful components and cricket logic. Inspect current HEAD before implementing; the last reviewed baseline was `3e030f9`, but it may have changed.

### Nonnegotiable distinction

- Local durable storage supports the scorer when offline.
- A shared backend establishes canonical accounts, players, teams, matches, permissions, and contributions.
- A public URL alone does not make local data available on another phone.
- Mock OTP and client-side `isVerified` are not authentication.
- A test that directly assigns an account/profile is not a real login test.
- A locally calculated leaderboard is not a shared platform until independent devices see the same canonical records.

### Budget and integration constraints

The user prefers zero hosting/database fees and requires mobile-number OTP.

- Use bounded free infrastructure where feasible, not unlimited-free claims.
- Real SMS OTP normally has a cost or limited promotional allowance. Explain this dependency honestly.
- Do not enable paid resources, send SMS, provision accounts, deploy publicly, or add credentials without approval.
- If credentials are missing, build/test with local development services and clearly mark production OTP/shared deployment blocked.
- Never pretend a development mock satisfies the user's account-based cross-device requirement.
- No hosted video, paid AI API, marketplace, auction, or social feed in the initial implementation.

---

## 1. Product acceptance: the experience must work across phones

### Primary scenario

1. Organiser signs in on Phone O and creates a tournament.
2. Captain signs in on Phone C, opens its registration link, and applies with their team and squad.
3. Organiser approves the entry on Phone O.
4. Scorer signs in on Phone S and scores an assigned match.
5. Player signs in on Phone P with a different account and sees their own live batting/bowling figures.
6. Spectator opens the public match URL without gaining scoring permission.
7. Scorer goes offline and continues recording locally; other phones display the last cloud update and a delayed-score warning.
8. Scorer reconnects. Pending actions are accepted exactly once; other phones catch up.
9. Match completes. Live/provisional performance remains visible.
10. Approved result updates official tournament standings and eligible career statistics.
11. A later authorised correction replaces the contribution and updates every affected screen without double-counting.

**Until this is demonstrated with independent clients, the shared-platform requirement is not complete.**

### Out-of-scope initially

Streaming infrastructure, AI-generated commentary, paid insights, contact harvesting, unsolicited SMS, global rankings without sufficient participation, and automated DLS without verified methodology/usage rights.

---

## 2. Interpret the reference screenshots as workflows, not exact copies

The user supplied five CricHeroes reference images. Reuse their useful information hierarchy, not protected branding, logos, imagery, or a pixel-for-pixel clone.

### Reference 1: scorer console

- Match header, back/share/settings actions.
- Dominant runs/wickets, current overs and innings limit.
- Current run rate; chase required rate or explicitly labelled projection.
- Striker/non-striker cards with runs and balls faced.
- Current bowler and spell.
- Recent-delivery ribbon.
- Large run keypad, extras, wicket and undo.

### Reference 2: scorecard

- Match-centre navigation.
- Both innings summary bars.
- Expand/collapse each innings.
- Batter rows: identity, dismissal, runs, balls, fours, sixes, strike rate.
- Bowling and fielding sections below.
- Any unfamiliar metric such as screenshot 'Min' is optional and must have a real definition/source. Do not invent it.

### Reference 3: tournament hub

- Branding, dates/location, share/follow and rules.
- Match/leaderboard/points-table/statistics/teams navigation.
- Live/upcoming/past match filters.
- Cards with stage, venue/time, score, result and approval/freshness labels.

### Reference 4: player leaderboard

- Ball-type/format and batting/bowling/fielding selectors.
- Clear ranking metric and statistical scope.
- Ranked player cards with avatar, team/location, figures and participation sample.
- Do not copy subscription badges such as PRO or imply paid capabilities you do not offer.

### Reference 5: player performance visualisation

- Player header and batting/bowling/comparison navigation.
- Filters by format, ball type, overs/phase where actually available.
- Wagon wheel based on recorded shot information.
- Legend distinguishing outcomes, unknown coverage, and handedness.
- No invented rays or shot data for unrecorded deliveries.

---

## 3. Recommended architecture and technology choices

### Application

Retain Expo/React Native, Expo Router and TypeScript. Support native mobile plus a responsive web experience for public profiles, tournament links and live scorecards.

### Local persistence

Use a repository abstraction with durable transactional storage appropriate to each supported target.

- Native: investigate `expo-sqlite` compatibility with installed SDK and runtime.
- Web: a tested IndexedDB adapter or supported SQLite web configuration with required headers/runtime capabilities.
- Do not assume a native database implementation works in web automatically.
- Keep AsyncStorage for lightweight preferences, not the only scorebook/queue transaction boundary.
- Migrate existing records safely with versioned backups and verifiable recovery.

### Shared backend

Recommended initial backend: Supabase-managed PostgreSQL, Auth, Storage and Realtime, staying within approved free-plan limits.

- One coherent relational backend initially.
- Backend migrations under version control.
- Auth with an approved SMS provider for real mobile OTP.
- Row-level security and protected transactional command operations.
- Realtime as change notification, not the durable source of truth.
- Small image storage only, with compression and quotas.
- Static web deployment on an approved free host for public pages.

Verify current pricing, provider availability and framework compatibility before deployment. Document region, expected limits, pausing behaviour, storage/egress/realtime budgets and fallback.

### Logical layers

1. Presentation: screens, interactions, accessibility.
2. Application commands: scoring, registration, review, correction, claims.
3. Domain: cricket engine, eligibility, standings, statistics definitions.
4. Repositories: local and remote persistence.
5. Sync: queue, acknowledgements, revisions, conflicts.
6. Backend authority: authenticated permissions and canonical transactions.

No network calls or platform imports inside the pure cricket engine.

### Modules

Identity, Players, Teams, Tournaments, Entries/Eligibility, Fixtures, Match Scoring, Approvals, Statistics, Publishing, Synchronisation, Administration.

Do not implement microservices merely because the product has several modules.

---

## 4. Account identity and cricket-player identity

### Separate identities

- Auth user: the login/session identity.
- Player: the permanent cricket identity that participates in matches.
- Membership: a player's relationship to a team over time.

A scorer may have an account without playing. A player may exist without an account. The same player can have memberships in multiple teams subject to competition policy.

### Mobile authentication

- Country selection and validated E.164 number.
- Server/provider-backed OTP request and verification.
- Expiry, server-side attempt limits, resend cooldown, abuse controls.
- Paste/platform OTP autofill where supported.
- Signed session and refresh handling.
- Native tokens in approved secure storage; review web session/token strategy separately.
- Logout, token expiry and session revocation.
- Phone-change/recovery procedure.
- Never expose OTP/token/phone in analytics logs.
- Never use a client-editable verification field as the authority boundary.

### Player claiming

- Captain may create an unclaimed player with minimum cricket details.
- Phone/contact information is private and optional where participation does not require it.
- Account can request to claim a candidate player.
- Mobile ownership proof may support a claim but is not an automatic merge-all rule.
- Handle incorrect/recycled/shared numbers and already-owned profiles through review.
- Preserve canonical aliases after an approved duplicate merge.
- Do not replace historical names with the account's default name.
- Record reviewer, evidence category, time and reversible decisions.

### My Cricket screen

Resolve the account's approved linked player ID, then query their canonical performances. Do not calculate 'my stats' from whichever roster object happens to be loaded locally.

Show claimed versus pending/unclaimed identity state clearly.

---

## 5. Shared database model

Provide actual migrations, keys, constraints, policies and indexes. The following defines responsibilities, not final SQL.

### Identity and teams

- `account_profiles`: account ID, display preferences, private settings.
- `players`: canonical player ID, public cricket details, identity status.
- `player_account_links`: authorised ownership/management link; enforce chosen cardinality policy.
- `player_claim_requests`: claim status and review.
- `player_aliases`: reviewed duplicate-to-canonical mapping.
- `player_private_contacts`: restricted contact information.
- `teams`: permanent team ID, branding, location.
- `team_memberships`: team/player, effective dates and cricket roles.
- `role_grants`: account, resource scope, role, effective/revoked state.

### Competition

- `tournaments`: settings, visibility, lifecycle, organiser, rules reference.
- `tournament_stages/groups`: league/knockout structure and qualification policies.
- `tournament_entries`: team application and approval status, applying account.
- `tournament_squad_members`: entry/player, eligibility and effective dates.
- `squad_amendment_requests`: requested change, reason, review.
- `ruleset_versions`: immutable playing/points/eligibility configuration.
- `venues`: grounds and scheduling details.

### Matches

- `matches`: canonical ID, visibility, teams/entries, tournament/stage, sporting status, approval status, revision.
- `fixtures`: either scheduled fields on matches or a separate planned-fixture record; choose and document one approach to avoid duplicate identities.
- `match_lineups`: frozen players and captain/wicketkeeper roles per side.
- `match_scorer_authority`: authorised writer, device/authority epoch.
- `innings`: batting/bowling side, limits, target/revised-target history.
- `match_actions`: ordered append-only actions, request ID, actor, revision, authority, rules/schema version, payload.
- `match_checkpoints`: derived replay checkpoints.
- `match_public_summaries`: compact published match state.
- `result_revisions`: structured outcome and approval review.
- `match_disputes`: review and resolution history.

### Statistics

- `player_innings_performances`: derived batting/bowling/fielding figures per innings/player/revision.
- `player_match_contributions`: eligible approved contribution per player/match/revision.
- `team_match_contributions`: team records and results.
- `standing_contributions`: points and NRR inputs per eligible match.
- `career_stat_totals`: rebuildable aggregates by supported scopes.
- `tournament_stat_totals`: rebuildable tournament aggregates.
- `award_records`: formula/manual awards with version and reviewer.

### Operations

- `media_assets`: owner, object key, size, visibility and processing status.
- `audit_records`: sensitive administrative actions.
- `notification_records`: persistent in-app notices where implemented.
- `projection_jobs/outbox`: durable pending derived-update work when not done transactionally.

### Constraints

- Unique event/request identity; retries cannot insert the same accepted action twice.
- Unique canonical sequence/revision position within a match.
- Unique active application per team/tournament according to stated lifecycle policy.
- No same team on both sides of a fixture.
- No duplicate lineup player/side; enforce competition restrictions.
- Match lineups reference eligible squad entries for official tournament matches.
- Preserve historical participant identity even when current membership ends.
- A friendly has an optional tournament reference; an official tournament match references approved entries.
- Full team/match copies must not become competing canonical records.
- Separate public views from private columns; RLS alone is not a column-privacy substitute.

### Indexes

Index actual query paths: player/date, team/date, tournament/stage/date/status, match/action sequence, entry/status, player membership, account role grants and contribution scopes. Measure before adding unnecessary indexes.

---

## 6. Permissions and public visibility

### Role matrix

- Visitor: read public profiles/tournament/match summaries only.
- Player account: edit approved own-profile fields; see own private account details.
- Team manager: manage their team, submit entries/lineups/amendments.
- Tournament organiser: manage their competition and review entries/amendments/results.
- Scheduler: authorised fixtures only.
- Assigned scorer: authorised scoring commands for assigned match/authority epoch.
- Approver: approved review scope; document whether self-approval is allowed.
- Platform administrator: exceptional audited review, not an unrestricted frontend switch.

### Enforcement

- Backend derives actor from authenticated session, never trusted client `reviewerUserId`.
- Protect scoring and review through transactional operations.
- Direct table writes cannot bypass command validation.
- No service-role/private key in frontend bundles.
- Verification is not ownership of unrelated teams.
- Audit grants, claims, approvals, reopening and merge actions.
- Public/private/unlisted visibility defined consistently for matches and profiles.
- A share link grants view/apply access, not administrative authority.
- Minors default to conservative disclosure; no exact birth date, phone or home location in public scorecards.

### Tests

Use different real test accounts to prove player cannot score, captain cannot approve unrelated entry, spectator cannot read contacts, and revoked scorer cannot write.

---

## 7. Scoring domain: reliable record, not total counter

### Input and action model

Events/actions include:

- Innings setup/openers.
- Delivery.
- Bowler selection/change.
- Batter selection.
- Retirement and return.
- Explicit end correction.
- Penalties and umpire-directed decisions.
- Revised target.
- Innings closure.
- Correction/undo effective-action change.
- Result submission/review.

Delivery captures separate batter runs, wide/no-ball/byes/leg-byes/penalty components, physical completed runs, boundary type, legal-ball treatment, dismissed player/fielder information, ends, free-hit context and optional observed shot data.

### Validation

- Nonnegative integer values and compatible components.
- Actual eligible participants and distinct batters.
- Valid dismissal matrix for current no-ball/wide/free hit.
- Bowler wicket whitelist.
- Correct legal balls and balls-faced conventions.
- Retirement does not manufacture a ball.
- Correct run-out end placement and end-over transition.
- Enforced innings completion and configured bowler limits.
- Rules frozen per match, not changing with tomorrow's app defaults.

### Pure engine

- Deterministic input/output.
- Do not mutate caller actions.
- Shared/client/backend versions compatible.
- Explicit rejection/warning result; no meaningless unconditional accepted flag.
- Corrections revalidate dependent events; impossible later participation requires review.

### UI outcome

The command returns the accepted action, committed revision, durable status, effective wicket, correct vacant end, bowler selection requirement, innings/result transitions and warning.

Celebrations and selection modals follow that result, not the requested intent.

---

## 8. Offline scorer and canonical cloud synchronisation

### Local command transaction

1. Assign stable command/event ID once.
2. Serialise all match-mutating commands, not only deliveries.
3. Read latest local state.
4. Validate and compute next state.
5. Atomically persist action, local projection and pending-sync outbox.
6. Acknowledge Saved on this device.
7. Attempt remote synchronisation without blocking next normal local action.

If local persistence fails, do not silently acknowledge the event as durable. Keep explicit retry/recovery. **Retry uses the same ID and operation; it must never reapply a failed single as a second single.**

### Remote command

- Actor/session validated server-side.
- Authorised scorer/authority epoch.
- Expected canonical revision.
- Idempotency key.
- Rules and schema versions.
- Domain validation and canonical projection update.
- Event append, revision increment and critical result state committed together.
- Durable follow-up jobs for noncritical aggregates if needed.

A database function/RPC must not claim to execute the TypeScript engine directly. Choose a compatible trusted server execution path and explicitly document how domain validation and transactional revision checks are enforced. Reject unsupported schema/engine versions safely.

### Acknowledgement lost

Server accepted event but device missed response: retry the same ID returns prior acceptance. No duplicate runs, contributions, or notices.

### Conflict

- Do not merge scorebooks by timestamps or last-write-wins.
- Pull missing canonical actions and reconcile expected revision.
- Surface divergent branches for authorised review.
- Preserve rejected local actions for recovery/export.

### Scorer handover

- One active canonical writer initially.
- Increment authority epoch during handover.
- Old offline device cannot overwrite the new authority on reconnect.
- Explain unresolved offline branch and offer review/export.

### Recovery

App restart reloads durable queue/state. Browser background execution is best-effort; retry on foreground/network return. Distinguish local durable state from cloud state. Old data migration includes action-history compatibility.

---

## 9. Live viewing and My Cricket on another phone

### Bootstrap

A viewer fetches a canonical summary with revision and update timestamp. Detailed scorecard/timeline fetched only when needed.

### Updates

Realtime notification announces match ID/revision. Viewer fetches missing summary/events. On disconnect or notification loss, foreground refresh/polling reconciles revisions.

Realtime messages are not the scorebook and cannot be the only source for missed updates.

### My live performance

On the player's phone:

- Show currently participating live matches using canonical player ID.
- Batting runs/balls/boundaries/strike rate and dismissal status.
- Bowling balls/overs/concession/wickets/economy.
- Fielding contributions where recorded.
- Tap into full scorecard.
- Display last cloud update and provisional label.

No additional scorer interaction is required to update each player's phone.

### Offline visibility

Scorer's local events are visible on their device immediately after durable commit. Other devices cannot see them until sync. Show delayed status honestly; never imply magical live connectivity while offline.

### Fanout budgets

- Compact summaries and revision notifications.
- Do not broadcast full innings to every viewer for every delivery.
- Pause/reduce updates for hidden tabs and finished matches.
- Pagination for timeline/history.
- Cache public approved results; never public-cache private data.
- Instrument connection/message/egress quotas and graceful fallback.

---

## 10. Screen-by-screen specification

### 10.1 Authentication

Number → OTP → session → profile/link onboarding. Guest option remains. Show true provider errors, no fake dispatch alert. Production build cannot use demo bypass.

### 10.2 Home

My live matches, resume assigned scoring, upcoming fixtures, recent performances, followed/public matches. Clear no-data/loading/error/offline states. Demo records labelled and excluded from real career rankings.

### 10.3 My Cricket

My canonical player profile, current performance, career breakdowns, recent form, teams, awards, account/claim state. Show provisional contributions separately from official totals.

### 10.4 Player profile

Header: name/avatar, cricket role/style, permitted location, follow/share. Tabs: overview, batting, bowling, fielding, matches, optional compare. Scope filters: season/date, format, ball type, team, tournament and verification/custom-rule eligibility.

### 10.5 Match centre

Tabs: Info, Summary, Scorecard, Timeline/Commentary, Squads, optional charts. Both innings expandable. Every batter/fielder/bowler links to canonical profile. DNB/retired statuses correct. No fabricated timing/shot metrics.

### 10.6 Scorer console

- Keep every React hook above conditional returns.
- Large score and overs; chase target/runs-needed/balls-left where applicable.
- Two batter cards, current bowler, recent ribbon.
- Keypad 0/1/2/3/4 boundary/6 plus custom runs and explicit four-ran option.
- Extras combined correctly and visibly armed/clearable.
- Wicket sheet identifies dismissed player, eligible dismissal, fielders and combined extras.
- Undo description names the action being reversed.
- Saved locally/Pending sync/Synced/Failed/conflict states.
- Failed save persistent banner with idempotent retry/export.
- Optional post-record detail entry; quick scoring default and persisted preference.
- Limited motion, large touch targets, readable sunlight/high contrast mode.
- Nonoverlapping batter/bowler/innings modals driven by committed outcome.

### 10.7 Team

Permanent branding, managers/memberships, history and stats. Team management is not tournament-squad editing. Show entered tournaments and link to their squad/eligibility views.

### 10.8 Tournament hub

Overview, Matches, Points Table, Leaderboards, Overall Stats, Teams/Squads, Rules/Announcements. Public viewing separate from private management workspace.

### 10.9 Organiser workspace

Applications, amendments, fixtures, role/scorer assignments, results/disputes and settings. Show missing details, timestamps and reasons. Actions require authenticated scoped authority.

### 10.10 Leaderboards

Rank, canonical player/avatar, team, participation, selected metric and relevant secondary figures. Disclose min sample and tie-breaks. Tournament scope distinct from career/location scope.

### 10.11 Performance charts

Worm/Manhattan based on actual scoring. Wagon wheel based on recorded shot sectors/direction, outcomes and known coverage. Broad sector entry must not imply exact measured shot angle. Observed/estimated/unknown clearly distinct. Off stays off. Do not fabricate pitch locations.

---

## 11. Tournament registration and roster policy

### Lifecycle

Draft → Registration open → Closed → Scheduled → Active → Completed → Archived; controlled cancellation/reopening.

### Creation

Dates/timezone, venues, format/ball type, innings/team/squad limits, team capacity, deadlines, points/tie-breaks, squad lock, eligibility/transfer rules, visibility, organisers and rule acknowledgement.

### Link flow

Public or unlisted URL opens readable tournament info. Authenticated authorised captain selects their team, submits squad, acknowledges rules, receives tracked application ID. Organiser approves/rejects/requests changes/waitlists with reason.

No duplicate active application. Enforce capacity under concurrent approval. Registration closed/locked cannot be bypassed by direct API calls.

### Squads

Permanent team edits do not alter approved squad. After lock use amendment request. One-team policy, replacements and eligibility dates are configurable. Reviewer audit required. Revoked entry eligibility follows a documented policy and does not leave stale enrolled copies.

### Fixtures

Schedule from approved entries without toss/openers. Stage/group, venue/time and scorer. Conflict warnings. Match-day lineup from eligible squad; freeze actual participants separately. Resolve future knockout placeholders after approved qualification.

### Results

Provisional → Submitted → Approved, or Disputed/Reopened. Sporting state separate. Structured winner/outcome/margin; no winner inference by substring matching display text. Corrected qualification affecting later matches requires organiser review.

---

## 12. Statistics and contribution design

### Separate layers

1. Live provisional match figures.
2. Approved eligible player/team contribution per match revision.
3. Rebuildable career/tournament aggregates.

Do not increment career totals on every delivered ball. Do not count the same accepted event or match twice after retries/imports/merges.

### Batting

Matches, innings, runs, balls faced, dismissals/not-outs, average, strike rate, highest score, boundary counts, milestones, participation and form.

### Bowling

Legal balls, displayed overs, runs conceded, wickets credited, maidens, average/economy/strike rate, best figures, wide/no-ball delivery counts and extra runs separately.

### Fielding

Catches, stumpings, direct/assisted run-outs using declared attribution policy. No efficiency score without opportunities/errors data.

### Definitions

Store raw denominators, not merely rounded rates. Overs formatted from integers; 17.3 is not a decimal quantity. Zero-denominator rates unavailable. Imported summaries preserve unknowns instead of inventing exact counts.

### Tournament totals

Runs, extras components, wickets, fours/sixes, legal balls, recorded delivery attempts, maidens, supported partnerships and records. Administrative actions are not delivered balls. Indicate partial data coverage.

### Standings

Configured points and tie-breaks; aggregate NRR inputs with correct effective-ball quotas, all-out treatment and supported interruption policy. No per-match NRR averaging. Eligibility based on approved results or an explicitly declared provisional policy. Super-over treatment defined.

### MVP

Versioned transparent performance-points formula frozen per tournament; component breakdown, participation and tie-breaks. Formula MVP separate from organiser-selected award. Acknowledge boundary/sample-size biases.

### Corrections

Replace old contribution by match/revision, recompute affected totals/records/standings, invalidate caches and notify viewers with new revision. Reopen/undo/delete cannot leave old official totals silently intact. Preserve audit and validate downstream bracket consequences.

### Exports

Filtered CSV and scorecard PDF/image. Generate client-side where practical. CSV properly escapes values; file/share action actually exports, not just an editable text modal labelled download. Full versioned backup/import with duplicate review.

---

## 13. Backend commands and API contracts

Document inputs, authority, transaction scope, output, idempotency and failure codes for:

- OTP request/verification/session.
- Player create/update/claim/review/merge.
- Team create/membership/manage roles.
- Tournament create/publish/update lifecycle.
- Entry submit/resubmit/withdraw/review.
- Squad amendment submit/review.
- Fixture create/reschedule/resolve participants.
- Lineup submit/lock/replacement.
- Scorer assign/handover/revoke.
- Match action batch submit/pull revisions.
- Correction/undo/replay review.
- Result submit/approve/dispute/reopen.
- Public summary/scorecard/history queries.
- My player performances/career totals.
- Tournament standings/statistics/leaderboards.
- Export and privacy requests.

Responses include stable canonical IDs, revisions, accepted/pending/rejected status, structured next actions and recoverable errors. Never accept actor ownership from an arbitrary client parameter.

---

## 14. Deployment, privacy and operations

- Approved region and provider setup.
- Separate development and production configurations.
- No secrets committed; environment example contains placeholders only.
- Migration deployment and rollback procedure.
- HTTPS/deep links and public web routes.
- Security policies for auth redirects, upload types/sizes and image metadata stripping.
- Database/metadata and file backups; restore test, not only backup creation.
- Quota dashboard, warnings and controlled nonessential feature degradation.
- Offline core never drops events because cloud quota exhausted.
- Error logs without personal contacts/tokens.
- Unclaimed/claimed profile deletion and historical-record policy documented.
- Notifications default to in-app/approved push; avoid SMS spend for routine updates.

---

## 15. Mandatory test matrix

### Regression tests from the previous review

- Failed save + retry records exactly one single/event.
- Scorer renders from null active match to loaded state without conditional-hook error.
- Negative/fractional/inconsistent runs and invalid participants are rejected.
- Closed/locked registration rejects submission at the service/backend layer.
- Duplicate application/retry produces one entry.
- Unrelated user cannot approve or lock tournament.
- Approval revocation does not leave fixture-eligible stale team state.
- Tournament route creates a tournament-associated fixture, not a friendly.
- Explicit small-sided UI configuration reaches engine wicket limits.
- Reopened/corrected match removes/replaces official contribution.

### Cricket matrix

No-ball/byes/leg-byes, wide stumping, no-ball/free-hit dismissal restrictions, boundary versus runs, both run-out ends, end-over wicket, retire/return, penalties, target by extras, winning boundary, all-out and bowler restrictions.

### Identity/security

Different user sessions, claim conflicts, recycled/shared numbers, unrelated team edits, private contact visibility, revoked scorer and direct-write bypass attempts.

### Sync/failure

Lost acknowledgement, duplicate retries, multi-hour offline, foreground resume, authority handover while old device offline, delayed/overlapping writes, app crash, storage full/corrupt, migration interruption and cloud quota/network errors.

### Product workflows

Guest friendly; public tournament registration; changes requested/resubmission; lock/amendment; scheduled fixture without toss; eligible lineup; result approval/dispute/correction; player viewing own performance from independent device.

### Performance and accessibility

Representative match-history size, multiple live viewers, efficient summary updates, pagination, screen reader, large text, reduced motion and actual device measurements. Do not invent performance/SLA evidence.

---

## 16. Work plan and release gates

### Stage 1 — Honest reliable local scorer

Repair retry, hook order, validation, all-command serialisation and historical migration. Existing local matches remain usable. Deliver regression evidence.

### Stage 2 — Canonical backend and identity

Migrations, local dev setup, RLS, canonical players/teams/roles, auth interface and real OTP integration only when approved. Demonstrate separate-account private/public access.

### Stage 3 — Shared matches and My Cricket

Server command validation, revisions/outbox/authority, live summary publishing, player performance reads, cross-device scorecard and spectator route. Demonstrate offline catch-up without duplicates.

### Stage 4 — Tournament governance

Entries/squads, approvals, real registration links, fixture/lineup flow and result reviews. Demonstrate organiser/captain on different clients.

### Stage 5 — Statistics and visual experience

Contribution-based career/tournament figures, standings, leaderboards, screenshots-inspired screens, truthful charts and exports. Corrections update all views.

### Stage 6 — Pilot and production configuration

Independent scorebook pilot, fault/security/device verification, backup restore, approved hosted deployment and clear operational limits.

Do not launch a shared platform from Stage 1 or call Phase 4 finished because its UI uses local mocks.

---

## 17. Agent deliverables and final report

Provide:

1. Architecture/entity diagram and documented decisions.
2. Backend and local schema migrations with constraints/policies/indexes.
3. Working real application commands and UI integration.
4. Safe existing-data migration and restore instructions.
5. Auth/SMS setup and spending limitations; blocked state if not configured.
6. API/permission/sync contracts.
7. Rules/statistics scope and provenance definitions.
8. Actual unit, application, backend-security, sync and device-test evidence.
9. Setup instructions, current supported Node/Expo versions, environment template.
10. Deployment/backup/quota/privacy notes.
11. New commit hashes and changed-file summary.
12. Requirement checklist marked Complete, Partial, Blocked or Not started.

### Final report must answer

- Can a player on a second phone sign in and see their own score?
- Is that sourced from the same canonical match as the scorer?
- What happens when the scorer is offline?
- Can an unrelated account score or approve a match?
- Does retry after a lost acknowledgement duplicate anything?
- Does a correction update career stats and points exactly once?
- Which integrations require credentials or spending approval?
- Which user workflows were actually exercised on independent devices?

**Final standard:** build one trustworthy shared cricket record that powers scoring, personal profiles, teams and tournaments. Do not build several disconnected screens that each maintain their own version of the score.
