# 🏏 Cric - Elite Cricket Scoring & Tournament Management Mobile App

[![Expo SDK 57](https://img.shields.io/badge/Expo-SDK_57-blue.svg)](https://expo.dev)
[![React Native 0.86](https://img.shields.io/badge/React_Native-0.86-61DAFB.svg)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6.svg)](https://www.typescriptlang.org)
[![Tests Passing](https://img.shields.io/badge/Tests-59%2F59_Passed-success.svg)](#testing)

A high-performance, account-based Cricket Scoring, Tournament Management, and Multi-Phone Live Performance platform built with **Expo SDK 57**, **React Native 0.86**, **Expo Router**, **Expo SQLite (WAL Mode)**, and **Supabase (PostgreSQL, Auth, Realtime, Edge Functions)**.

Designed for complete zero-infrastructure offline reliability, genuine MCC Laws of Cricket adherence, cross-device live scorecards, and ergonomic pitch-side scoring.

---

## 🌟 Key Features

### 1. 🏟️ Interactive Touch Wagon Wheel & Pitch Radar
- **Instant Dot-Ball Commit**: Quick Scoring enabled by default; dot deliveries commit instantly without modal interruption for rapid single-tap scoring on the field.
- **Visual Circular SVG Ground**: Non-dot deliveries (runs, boundaries, catches, and run-outs) open an interactive circular ground with **10 touchable annular sector wedges**:
  * *Behind Keeper*, *Third Man*, *Point*, *Cover*, *Mid-Off*, *Long-Off*, *Long-On*, *Mid-Wicket*, *Square Leg*, *Fine Leg*.
  * Left-Hand / Right-Hand dynamic mirroring (Off-side vs Leg-side field orientation).
- **Pitch Delivery Radar & Provenance Filter**:
  * Proportional 22-yard pitch strip (not squished) with popping creases, bowling crease, stumps, and length zones (*Short*, *Good Length*, *Full*, *Yorker*).
  * Dual Perspective Toggle: **By Bowler** vs **By Batter**.
  * Factual Data Provenance: Tagged as `🎯 Observed` (manual tap) or `✨ Estimated` (auto-derived from shot), with provenance filtering.

### 2. 📜 Trustworthy Cricket Scoring (MCC Laws Compliant)
- **100% Deterministic Undo**: Restores opening batter slots, striker/non-striker crease ends, bowling figures, and over boundaries cleanly via immutable replay origin.
- **Boundary Extras Attribution**: Boundary byes and leg-byes award team extras and 0 bowler concession; batter runs and batter fours remain 0.
- **Law 21.19 & 22.17 Dismissal Legality Matrix**: Strictly validates dismissals on No-Balls and Wides. Bowled, Caught, LBW, Stumped, and Hit Wicket on a No-Ball or Free Hit are validated as illegal and negated.
- **Bowler Credit Whitelist**: Strict whitelist of bowler-credited dismissals (`bowled`, `caught`, `caught_and_bowled`, `lbw`, `stumped`, `hit_wicket`). Run out, retired out, and hit the ball twice never credit the bowler.
- **Non-Delivery Retirements**: MCC Law 25.4 `Retired Hurt` (not out, wickets unchanged) and `Retired Out` recorded as explicit actions without manufacturing phantom deliveries or incrementing balls faced.
- **Compound Extras**: Full support for No-Ball penalties combined with byes, leg-byes, or bat runs, with physical run parity dictating end placements.

### 3. 🛡️ Durable Offline Persistence & Data Migration
- **Match-Scoped Partitioning**: Each match is isolated under `@cric_match_<id>` with a master index at `@cric_match_ids_v2`, preventing write amplification.
- **In-Memory Write Serialization Queue**: Sequential promise execution guarantees atomic FIFO write order per match, eliminating write-interleaving race conditions.
- **Zero-Loss Migration**: Automatically detects and migrates legacy monolithic records from `@cric_matches_v1`, creates verified backups under `@cric_matches_v1_backup`, and handles corruptions gracefully with structured `StorageError` codes.

### 4. 👤 Honest Authentication & Ghost Accounts
- **Default Guest Scorer**: Fresh installs start as an unauthenticated Guest Scorer without simulated fake cloud profiles.
- **Offline Scoring First**: Guest users can immediately score matches offline without phone verification or internet connectivity.
- **Canonical E.164 Phone Normalization**: Eliminates trailing 10-digit collisions across country codes (+1 vs +91).
- **Ghost Player Support**: Captains can add teammates to club rosters as "Ghost Players" with a Name and Phone Number; when a user registers or signs in with that number, historical match records and stats are automatically linked and claimed.

### 5. 🏆 Unrestricted Tournament Organization & Dynamic Points Table
- **Open Governance**: Any user with a verified profile can organize tournaments and fixtures.
- **Official ICC Net Run Rate (NRR) Formula**:
  $$\text{NRR} = \left(\frac{\text{Runs Scored}}{\text{Overs Faced}}\right) - \left(\frac{\text{Runs Conceded}}{\text{Overs Bowled}}\right)$$
  * Implements the **ICC All-Out Rule**: If a team is bowled out inside their allotted overs, the full innings quota is credited as the divisor.
  * Epsilon normalization eliminates `+-0.000` float artifacts.
- **Dynamic Leaderboards (Zero Hardcoding)**:
  * **Fantasy MVP**: Calculated dynamically across all tournament fixtures.
  * **Orange Cap & Purple Cap**: Dynamic run and wicket leaderboards.

---

## 🏗️ Architecture

```
src/
├── app/                      # Expo Router screens
│   ├── (tabs)/               # Bottom tabs (Matches, Teams, New Match, Profile, Settings)
│   ├── auth/login.tsx        # Phone OTP authentication & guest flow
│   ├── match/[id]/           # Match center & live ball-by-ball scorer console
│   ├── player/[id].tsx       # Player profile & career statistics
│   ├── teams/[id].tsx        # Squad management & ghost player addition
│   ├── tournament/[id].tsx   # Tournament hub (NRR standings & leaderboards)
│   └── tournaments/create.tsx# Tournament creation wizard
├── components/
│   ├── match/                # WagonWheelSVG, PitchRadarSVG, ShotAreaSelectorModal, etc.
│   └── common/               # Badges, Buttons, Cards
├── context/                  # CricketContext (global state provider)
├── engine/                   # CricketEngine & StatsRollupEngine (pure TypeScript)
├── services/                 # Tactile haptics (expo-haptics)
├── storage/                  # AsyncStorage persistent storage & migration engine
├── types/                    # Domain models & type definitions
└── utils/                    # Colors & stadium night theme tokens
```

---

## 📚 Technical Documentation

- 🏛️ [Shared Platform Architecture & Contracts](docs/shared-platform-architecture.md): Cross-device synchronization, Supabase schema & RLS, Edge Functions, SQLite outbox, and dev authentication.
- 📜 [Cricket Rules Compliance Matrix](docs/cricket-rules-matrix.md): Exhaustive breakdown of MCC Laws, dismissal legality, extras, and Free Hit rules.
- 💾 [Data Migration & Storage Architecture](docs/data-migration.md): Partitioning model, write serialization queue, and migration algorithm.
- 📋 [Remediation Verification Report](docs/verification-report.md): Defect matrix, root cause analyses, and test execution results.
- 📝 [Remediation Plan](docs/remediation-plan.md): Initial baseline and staged remediation roadmap.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (`v18+`, verified on `v26.3.0`)
- npm or bun

### Installation
```bash
# Clone the repository
git clone https://github.com/Ashish-331/cric.git
cd cric

# Install SDK-compatible dependencies
npx expo install
```

### Running the App
```bash
# Start the Expo development server
npx expo start

# Open on Web
Press 'w' in terminal

# Open on iOS / Android
Scan QR code with Expo Go or run a development build
```

---

## 🧪 Testing & Verification

The codebase is fortified with comprehensive automated test suites covering rules logic, NRR calculations, ghost claiming, rollups, and end-to-end user journeys:

```bash
# Run all automated test suites (59 passing tests)
npm test

# Typecheck with TypeScript (0 errors)
npx tsc --noEmit

# Diagnose Expo configuration (21/21 passed)
npx expo-doctor
```

---

## 📄 License
MIT
