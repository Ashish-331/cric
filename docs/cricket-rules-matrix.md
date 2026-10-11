# Cricket Rules Compliance Matrix

This document defines the ruleset, Laws of Cricket implementation, dismissal eligibility matrix, and extras attribution enforced by the **Cric** scoring engine.

---

## 1. MCC Laws of Cricket (2017 Code, 3rd Edition — 2022) Alignment

| MCC Law | Subject | Cric Engine Implementation | Validation / Tests |
| :--- | :--- | :--- | :--- |
| **Law 18** | Scoring Runs | Physically completed runs dictate crease ends. Boundary 4 or 6 awards runs directly without physical crossing. | `cricketEngine.ts: applyDelivery`, `remediation_stage_a_regression.test.ts` |
| **Law 21** | No Ball | 1 penalty run added to team extras. Ball does not count towards legal balls in over. Dismissal legality restricted per Law 21.19. Triggers Free Hit where applicable. | `cricketEngine.ts: validateDismissalLegality`, `rules_and_cricketing_depth.test.ts` |
| **Law 22** | Wide Ball | 1 penalty run added to team extras. Ball does not count towards legal balls in over. Dismissal legality restricted per Law 22.17. | `cricketEngine.ts: validateDismissalLegality`, `unit_engine.test.ts` |
| **Law 23** | Bye and Leg-Bye | Team extras credited to byes/leg-byes. Batter runs and batter boundaries are **0**. Bowler is **not** charged for byes or leg-byes. | `cricketEngine.ts: applyDelivery`, `remediation_stage_a_regression.test.ts` (CRIC-002) |
| **Law 25.4** | Batter's Retirement | Explicit non-delivery action (`retireBatter`). **Retired Hurt** does not count as a dismissal and leaves wickets lost unchanged. **Retired Out** counts as a dismissal without bowler credit. Does not increment legal balls or balls faced. | `cricketEngine.ts: retireBatter`, `CricketContext.tsx`, `remediation_stage_a_regression.test.ts` (CRIC-005) |
| **Law 31** | Appeals & Wickets | Handled via dismissal modal. Fall of wickets records score, wicket number, and partnership. | `WicketModal.tsx`, `cricketEngine.ts` |
| **Law 33** | Caught | Legal only on fair deliveries. Prohibited on No-Ball and Free Hit. Credits bowler and fielder. | Matrix check: `BOWLER_CREDITED_DISMISSALS` |
| **Law 34** | Hit the Ball Twice | Prohibited on Wide. Batter is out. **Does not credit bowler**. | `cricketEngine.ts` (CRIC-004) |
| **Law 35** | Hit Wicket | Legal on fair delivery and Wide. Prohibited on No-Ball and Free Hit. Credits bowler. | Matrix check: `validateDismissalLegality` |
| **Law 36** | Leg Before Wicket (LBW) | Prohibited on No-Ball, Wide, and Free Hit. Credits bowler. | Matrix check: `validateDismissalLegality` |
| **Law 37** | Obstructing the Field | Legal on all delivery types. **Does not credit bowler**. | Matrix check: `validateDismissalLegality` |
| **Law 38** | Run Out | Legal on all delivery types (No-Ball, Wide, Free Hit, Fair). Credits fielder(s), **never credits bowler**. Supports zero, one, or multiple completed runs prior to run out. | `cricketEngine.ts: applyDelivery`, `remediation_stage_a_regression.test.ts` (CRIC-006) |
| **Law 39** | Stumped | Legal on fair delivery and Wide. Prohibited on No-Ball and Free Hit. Credits bowler and wicket-keeper. | Matrix check: `validateDismissalLegality` |

---

## 2. Dismissal Legality Matrix

The engine validates dismissal legality through `CricketEngine.validateDismissalLegality(dismissal, isNoBall, isWide, isFreeHit)`. Any prohibited dismissal returns `{ isLegal: false, reason: string }` and is negated:

| Dismissal Type | Fair Delivery | Current No-Ball | Current Wide | Existing Free Hit | Bowler Credited? |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Bowled** | ✅ Legal | ❌ Prohibited | ❌ Prohibited | ❌ Prohibited | ✅ Yes |
| **Caught** | ✅ Legal | ❌ Prohibited | ❌ Prohibited | ❌ Prohibited | ✅ Yes |
| **Caught & Bowled** | ✅ Legal | ❌ Prohibited | ❌ Prohibited | ❌ Prohibited | ✅ Yes |
| **LBW** | ✅ Legal | ❌ Prohibited | ❌ Prohibited | ❌ Prohibited | ✅ Yes |
| **Stumped** | ✅ Legal | ❌ Prohibited | ✅ Legal (Law 39.1) | ❌ Prohibited | ✅ Yes |
| **Hit Wicket** | ✅ Legal | ❌ Prohibited | ✅ Legal (Law 35.1) | ❌ Prohibited | ✅ Yes |
| **Run Out** | ✅ Legal | ✅ Legal (Law 38.1) | ✅ Legal (Law 38.1) | ✅ Legal (Law 38.1) | ❌ No |
| **Obstructing Field** | ✅ Legal | ✅ Legal (Law 37.1) | ✅ Legal (Law 37.1) | ✅ Legal (Law 37.1) | ❌ No |
| **Hit Ball Twice** | ✅ Legal | ❌ Prohibited | ❌ Prohibited | ❌ Prohibited | ❌ No |
| **Timed Out** | ✅ Legal | ❌ Prohibited | ❌ Prohibited | ❌ Prohibited | ❌ No |
| **Retired Out** | ✅ (Non-delivery) | ❌ N/A | ❌ N/A | ❌ N/A | ❌ No |
| **Retired Hurt** | ✅ (Non-delivery) | ❌ N/A | ❌ N/A | ❌ N/A | ❌ No (Not Out) |

---

## 3. Bowler Concessions & Extras Accounting

| Scenario | Total Team Runs | Batter Runs | Extras Breakdown | Bowler Concession | Legal Ball? |
| :--- | :---: | :---: | :--- | :---: | :---: |
| Dot ball | +0 | +0 | None | +0 | ✅ Yes |
| 1 Bat run | +1 | +1 | None | +1 | ✅ Yes |
| Boundary 4 (Off Bat) | +4 | +4 | None | +4 | ✅ Yes |
| Boundary 4 (Byes) | +4 | +0 | Byes: +4 | +0 | ✅ Yes |
| Boundary 4 (Leg-Byes)| +4 | +0 | Leg-byes: +4 | +0 | ✅ Yes |
| Wide (no run) | +1 | +0 | Wide: +1 | +1 | ❌ No |
| Wide + 2 runs | +3 | +0 | Wide: +3 | +3 | ❌ No |
| No-Ball (no run) | +1 | +0 | No-Ball: +1 | +1 | ❌ No |
| No-Ball + 4 (Off Bat)| +5 | +4 | No-Ball: +1 | +5 | ❌ No |
| No-Ball + 2 Byes | +3 | +0 | No-Ball: +1, Byes: +2 | +1 | ❌ No |

### Key Invariant:
- **Batter Fours/Sixes**: Only incremented when `isBoundary: true` AND `runsBat >= 4` (or `runsBat === 6`). Boundary byes or leg-byes never increment batter boundary counts or MVP boundary bonus points.

---

## 4. Limited-Overs Playing Conditions & Free Hit State Machine

In accordance with ICC Standard Playing Conditions for T20 and ODI cricket:
1. **Trigger**: Any No-Ball (front foot, height, or fielding restriction) awards 1 run and makes the next delivery a **Free Hit**.
2. **Carry-Over**: If the delivery intended as a Free Hit results in a Wide or No-Ball, the Free Hit status carries forward to the following legal delivery.
3. **Dismissal Restrictions**: A batter cannot be dismissed on a Free Hit except by:
   - Run Out
   - Obstructing the Field
   - Hit the Ball Twice
4. **Resolution**: Once a legal delivery is bowled on a Free Hit (even if runs are scored, dots occur, or a permitted dismissal occurs), the Free Hit status ends.

---

## 5. Non-Delivery Actions (Retirement & Strike Adjustments)

1. **Retire Batter**:
   - Executes via `CricketEngine.retireBatter(innings, playerId, 'retired_hurt' | 'retired_out')`.
   - Modifies `batterStats[playerId]` state directly.
   - Appends an immutable `InningsAction` (`{ type: 'RETIRE_BATTER', playerId, reason, timestamp }`).
   - Does not create a phantom delivery or increment legal balls in the over.
2. **Return Batter**:
   - Permitted only for players with status `retired_hurt`.
   - Executes via `CricketEngine.returnBatter(innings, playerId, targetSlot)`.
   - Restores the player to the selected crease slot (`striker` or `nonStriker`).
3. **Undo Semantics**:
   - `undoDelivery` removes the last delivery and recalculates the innings state deterministically from the immutable innings start state (`initialStrikerId`, `initialNonStrikerId`, `initialBowlerId`) and effective replay projection.
