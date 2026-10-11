# Cric Shared Platform — Architecture & Contracts Specification

## 1. Executive Summary

Cric is an account-based, cross-device cricket platform built with **Expo SDK 57**, **React Native 0.86**, **TypeScript**, **Expo SQLite**, and **Supabase (PostgreSQL, Auth, Realtime, Edge Functions)**.

The platform transforms pitch-side cricket scoring from a single-device tally tool into a multi-phone shared experience:
- **Phone S (Scorer)**: Authorised match scorer records deliveries ball-by-ball locally with zero network latency. All mutations append to a durable outbox with sequential revision numbering.
- **Phone P (Player)**: Participating players sign into their account on their own devices and view their personal real-time batting and bowling figures (*My Live Performance*) from the same canonical match.
- **Phone O (Organiser)**: Organises grassroots tournaments, schedules fixtures, sets playing conditions, reviews squad registrations, and approves match results.
- **Phone C (Captain)**: Submits team entries, registers squads, and nominates lineups via responsive web or native mobile.
- **Spectator Devices**: Follow live matches in read-only mode without scoring authority.
- **Offline Scorer Graceful Handling**: When the scorer is offline, the match continues to record locally. Viewer devices display a delayed cloud notice. Upon reconnection, pending deliveries sync exactly once with guaranteed idempotency.

---

## 2. Architecture & Logical Layers

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                              │
│  Expo Router Native & Responsive Web (Arena, Match Centre, My Cricket) │
└───────────────────▲────────────────────────────────▲───────────────────┘
                    │                                │
┌───────────────────┴────────────────────────────────┴───────────────────┐
│                    APPLICATION COMMANDS & CONTEXT                      │
│      CricketContext (FIFO mutation queue, optimistic local commit)     │
└───────────────────▲────────────────────────────────▲───────────────────┘
                    │                                │
┌───────────────────┴────────────────┐   ┌───────────┴───────────────────┐
│       PURE DOMAIN ENGINE           │   │      REPOSITORIES & SYNC      │
│  CricketEngine & StatsRollupEngine │   │ SQLite Repositories (WAL)     │
│  (100% platform-independent TS)    │   │ SyncService & Durable Outbox  │
└────────────────────────────────────┘   └───────────▲───────────────────┘
                                                     │
                                                     │ (HTTPS / Realtime)
                                         ┌───────────▼───────────────────┐
                                         │       CANONICAL BACKEND       │
                                         │ Supabase Edge Functions       │
                                         │ PostgreSQL (RLS Policies)     │
                                         └───────────────────────────────┘
```

### 2.1 Pure Domain Isolation
[`src/engine/cricketEngine.ts`](file:///home/ashish/Desktop/cric/src/engine/cricketEngine.ts) contains zero platform dependencies, native bindings, or network calls. It enforces MCC Laws of Cricket, legal delivery calculation, crease end rotation, fall-of-wicket recording, and deterministic 1-tap undo.

### 2.2 Durable Local SQLite Persistence
- **Engine**: SQLite via `expo-sqlite@~57.0.x` configured in **WAL (Write-Ahead Logging)** mode.
- **Relational Tables**: `sqlite_matches`, `sqlite_teams`, `sqlite_players`, `sqlite_tournaments`, `match_actions_outbox`.
- **Durable Outbox**: Every scoring command atomically writes to both the local match record and `match_actions_outbox` in a single SQLite transaction before UI acknowledgment.
- **Legacy Migration**: Existing AsyncStorage records are safely detected, backed up under `@cric_matches_v1_backup`, and migrated into SQLite tables idempotently.

---

## 3. Canonical Backend Schema & Permissions

Located in [`supabase/migrations/`](file:///home/ashish/Desktop/cric/supabase/migrations/):

### 3.1 Relational Tables ([`20261011000001_cric_canonical_schema.sql`](file:///home/ashish/Desktop/cric/supabase/migrations/20261011000001_cric_canonical_schema.sql))
1. `profiles`: Canonical user identity linked to `auth.users.id`.
2. `teams`: Team branding, short code, and primary colors.
3. `players`: Public cricket participant identities.
4. `player_account_links`: Maps authenticated user accounts to player participant records.
5. `tournaments`: Tournament settings, format, ball type, and status lifecycle.
6. `tournament_entries`: Team registration applications with status (`draft`, `submitted`, `approved`, `rejected`).
7. `tournament_squad_members`: Nominated players for a tournament entry.
8. `matches`: Canonical match record with `revision`, `authority_epoch`, `status`, and `scorer_player_id`.
9. `match_lineups`: Frozen playing XI rosters for team 1 and team 2.
10. `innings`: Innings breakdown and score targets.
11. `deliveries`: Canonical ball-by-ball record.
12. `match_actions_outbox`: Cloud audit ledger of all submitted scoring actions.

### 3.2 Row-Level Security Matrix ([`20261011000002_rls_and_permissions.sql`](file:///home/ashish/Desktop/cric/supabase/migrations/20261011000002_rls_and_permissions.sql))
| Role | Match Scoring | View Public Matches | Manage Teams | Submit Tournament Entry | Approve Results |
|---|---|---|---|---|---|
| **Assigned Scorer** | Write (Assigned Match) | Read | Read | No | No |
| **Organiser** | No (unless assigned) | Read | Read | No | Write (Owned Tournaments) |
| **Captain** | No | Read | Write (Owned Team) | Write (Owned Team) | No |
| **Player** | No | Read | Read | No | No |
| **Spectator / Visitor** | No | Read | Read | No | No |

---

## 4. Server-Side Scoring & Revision Lock Sequence

Scoring actions submitted to the cloud execute through Supabase Edge Function [`commit-match-action`](file:///home/ashish/Desktop/cric/supabase/functions/commit-match-action/index.ts):

1. **JWT Verification**: Validates caller's session token and extracts actor identity (`auth.uid()`).
2. **Authority Check**: Verifies that the actor is the designated scorer for the match (`scorer_player_id = actor_id`) and that the match is active.
3. **Optimistic Revision Check**: Requires caller's `expectedRevision`. If the canonical revision has moved, returns `HTTP 409 Conflict` with the latest canonical revision.
4. **Idempotency Detection**: If `actionId` has already been committed, returns the previous accepted response immediately without creating duplicate deliveries or advancing the revision.
5. **Action Validation & Projection**: Calculates the next state using the shared cricket engine rules.
6. **Atomic Transactional Commit**:
   ```sql
   UPDATE matches
   SET revision = revision + 1, last_updated = now()
   WHERE id = $matchId AND revision = $expectedRevision;
   ```
   Commits delivery record, advances revision, and updates live projection.

---

## 5. Development Authentication (Option A)

To achieve zero cloud hosting/SMS carrier expenses during development, the application utilizes Supabase Auth with pre-configured dev test phone numbers:

| Role | Test Phone Number | Dev OTP | Account Scope |
|---|---|---|---|
| **Tournament Organiser** | `+919876543210` | `123456` | Creates tournaments, approves entries & results |
| **Team Captain** | `+919876543211` | `123456` | Manages club teams & tournament entries |
| **Assigned Scorer** | `+919876543212` | `123456` | Ball-by-ball scoring authority |
| **Cricket Player** | `+919876543213` | `123456` | Views personal figures in My Cricket |

*Production carrier SMS OTP is marked as blocked pending carrier provider credentials and spending approval.*

---

## 6. Verification & Automated Test Coverage

The platform is validated with **59 passing tests** across 8 suites:
- `tests/stage1_regression.test.ts`: Retry deduplication, React hook order stability, invalid participant rejection, FIFO mutation serialization.
- `tests/sqlite_repository_auth.test.ts`: E.164 phone normalization, dev test accounts, outbox lifecycle.
- `tests/stage3_shared_matches_my_cricket.test.ts`: Scorer outbox queue, player live figures resolution, spectator permission checks, offline reconnection idempotency.
- `tests/unit_engine.test.ts`: Ball scoring, extras, maidens, dismissals, 1-tap undo.
- `tests/stats_rollup.test.ts`: Career stats calculations, milestones, rolling form.
- `tests/storage_resilience.test.ts`: Match-scoped persistence, AsyncStorage migration.
- `tests/tournament_ghost_radar.test.ts`: Dynamic NRR, Fantasy MVP, pitch radar sectors.
