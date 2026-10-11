# Cric Remediation Plan

## Baseline Information
- **Repository:** https://github.com/Ashish-331/cric.git
- **Reviewed Baseline Commit:** `7406dc46e72c3eb488b3e9c46c3c71c0dae49a7a` (`7406dc4`)
- **Node Version:** `v26.3.0`
- **npm Version:** `11.16.0`
- **Target Platform:** Expo SDK 57, React Native 0.86, Expo Router, TypeScript, AsyncStorage
- **Existing Tests:** 32 tests passing across 6 test suites before remediation.

---

## Remediation Objectives & Bounded Stages

### Stage A — Cricket Scoring Correctness (P0)
1. **CRIC-001 (Undo Replay Origin & Strike Restoration):**
   - Implement immutable innings-start state (`initialStrikerId`, `initialNonStrikerId`, `initialBowlerId`) and action history/events.
   - Replay from innings origin so undoing the only single/boundary/dot returns original striker and non-striker.
2. **CRIC-002 (Boundary Byes / Leg-Byes Attribution):**
   - Decouple team boundary from batter boundary.
   - Four byes or four leg-byes award team +4 and byes/leg-byes +4, but batter runs and batter fours remain 0.
   - Bowler conceded runs remain 0 for byes and leg-byes.
3. **CRIC-003 (Dismissal Eligibility & No-Ball/Wide Restrictions):**
   - Build an explicit Law-compliant dismissal eligibility matrix.
   - On a no-ball: Bowled, Caught, LBW, Stumped, Hit Wicket are prohibited.
   - On a wide: Bowled, Caught, LBW are prohibited; Stumped and Run Out are allowed.
   - Suppress replacement prompts, fall of wickets, and bowler credit on illegal dismissals.
4. **CRIC-004 (Bowler-Credited Dismissals Whitelist):**
   - Replace negative blacklist with strict whitelist: Bowled, Caught, Caught & Bowled, LBW, Stumped, Hit Wicket.
   - `hit_twice`, `run_out`, `obstructing_field`, `timed_out`, `retired_out` do NOT credit bowler.
5. **CRIC-005 (Retirement Action Modeling):**
   - Model retirement as an explicit non-delivery action (`InningsAction` / retirement event) between deliveries.
   - Do not manufacture phantom deliveries, balls faced, or overs bowled for retirements.
6. **CRIC-006 (Compound Extras & End Placement):**
   - Support compound extras (e.g., No-ball penalty + Byes/Leg-byes or bat runs).
   - Strike rotation derived from physically completed runs, not total run parity.
   - Run out records which batter was dismissed and completed runs.

### Stage B — Durable Local Operation (P0)
1. **STORE-001 (Structured Write Errors & Recovery):**
   - Propagate write errors to caller; do not swallow in `storageService`.
   - Prevent UI from showing durable save before local commit finishes.
   - Separate demo seed installation from error recovery.
2. **STORE-002 (Match-Scoped Transactions & Command Serialization):**
   - Serialise scoring commands per match to eliminate concurrent write races.
   - Use match-scoped storage keys (`@cric_match_<id>`) alongside a match registry.
   - Safe migration preserving existing historical records.

### Stage C — Integration and Stats (P1)
1. **DATA-001 (Metadata Forwarding):**
   - Forward `shotArea`, `pitchLength`, `pitchLine`, `pitchCoord`, and `bowlingSide` through the complete UI $\to$ command $\to$ engine $\to$ storage pipeline.
2. **DATA-002 (Factual Analytics Provenance):**
   - Label pitch data with provenance: `observed` / `estimated` / `unknown`.
   - Respect left-hand vs right-hand batter orientation in sector rendering.
3. **UI-001 & UI-002 (Outcome-Driven UI & Scorer Ergonomics):**
   - UI transitions driven by accepted command outcomes.
   - Quick scoring enabled by default.
   - Reduced celebrations in scorer mode.

### Stage D — Identity and Scoped Permissions (P0 / P1)
1. **AUTH-001 (Honest Demo vs Real Auth):**
   - Remove misleading celebrity defaults on fresh install.
   - Distinguish guest scorer mode from verified accounts.
2. **AUTH-002 (E.164 Validation & Safe Claims):**
   - Validate full E.164 phone numbers; do not match blindly on trailing 10 digits.
3. **PERM-001 (Scoped Roles):**
   - Protect team rosters and match edits with scoped team manager / creator checks.

### Stage E — Documentation and Deliverables
- `docs/remediation-plan.md`
- `docs/verification-report.md`
- `docs/cricket-rules-matrix.md`
- `docs/data-migration.md`
- Updated `README.md`
