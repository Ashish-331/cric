# 🏏 Cric - Elite Cricket Scoring & Tournament Management Mobile App

[![Expo SDK 57](https://img.shields.io/badge/Expo-SDK_57-blue.svg)](https://expo.dev)
[![React Native 0.86](https://img.shields.io/badge/React_Native-0.86-61DAFB.svg)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6.svg)](https://www.typescriptlang.org)
[![Tests Passing](https://img.shields.io/badge/Tests-32%2F32_Passed-success.svg)](#testing)

A high-performance, grassroots-to-professional Cricket Scoring, Tournament Management, and Player Analytics mobile application built with **Expo SDK 57**, **React Native 0.86**, **Expo Router**, and **AsyncStorage**.

---

## 🌟 Key Features

### 1. 🏟️ Interactive Touch Wagon Wheel
- **Instant Dot-Ball Commit**: Dot deliveries bypass modal interruption for rapid 1-tap scoring on the field.
- **Visual Circular SVG Ground**: Non-dot balls (runs, boundaries, catches, and run-outs) open an interactive circular ground with **10 touchable annular sector wedges**:
  * *Behind Keeper*, *Third Man*, *Point*, *Cover*, *Mid-Off*, *Long-Off*, *Long-On*, *Mid-Wicket*, *Square Leg*, *Fine Leg*.
- **3-Way Pitch Delivery Mapping**:
  * **Auto Mode**: Automatically deduces delivery length and line from the shot played (e.g., cut $\to$ short outside off, cover drive $\to$ full outside off, pull $\to$ short on stumps, sweep $\to$ full/yorker).
  * **Touch Pitch**: Interactive mini 22-yard pitch selector allowing manual length and line plotting.
  * **Off**: Skips pitch mapping completely.

### 2. 🎯 Slender 22-Yard Pitch Radar SVG
- Proportional 22-yard pitch strip (not squished) with popping creases, bowling crease, stumps, and 4 length zones (*Short*, *Good Length*, *Full*, *Yorker*).
- **Dual Perspective Toggle**:
  * **By Bowler**: Displays deliveries bowled by the selected bowler.
  * **By Batter**: Displays deliveries faced by the selected batsman.
- Plots real coordinates with tap-to-inspect delivery details.

### 3. 🏆 Unrestricted Tournament Organization & Dynamic Points Table
- **Open Governance**: Any user with a verified profile can create matches or tournaments without role restrictions.
- **Official ICC Net Run Rate (NRR) Formula**:
  $$\text{NRR} = \left(\frac{\text{Runs Scored}}{\text{Overs Faced}}\right) - \left(\frac{\text{Runs Conceded}}{\text{Overs Bowled}}\right)$$
  * Implements the **ICC All-Out Rule**: If a team is bowled out inside their allotted overs, the entire innings quota is credited as the divisor.
  * Epsilon normalization eliminates `+-0.000` float artifacts.
- **Dynamic Leaderboards (Zero Hardcoding)**:
  * **Fantasy MVP**: $\text{Runs} \times 1 + \text{4s} \times 1 + \text{6s} \times 2 + \text{Wickets} \times 25 + \text{Maidens} \times 8 + \text{Catches} \times 8 + \text{Stumpings} \times 12 + \text{RunOuts} \times 8$.
  * **Orange Cap**: Top run aggregate, balls faced, strike rate, high score.
  * **Purple Cap**: Top wicket aggregate, overs bowled, economy rate, best bowling.
  * **Top Fielders**: Catches, stumpings, and run-outs.

### 4. 👤 Ghost Accounts with Mobile Claiming Flow
- Captains can add teammates to club rosters as "Ghost Players" with just a Name and Phone Number.
- Ghost players can play in matches, bat, bowl, field, and accumulate career statistics.
- Unverified/guest accounts are restricted from organizing tournaments until verification.
- **Automated Phone Claiming**: When a user registers or logs in with their mobile number, prior match records and ghost profiles are automatically detected, claimed, and merged into their verified profile.

### 5. 🎙️ Broadcast Commentary & Event Trivia
- Commentary feed with live bowler spell figures `(2.1-0-14-1)` to batter `(42* off 28b)` from over/round the wicket.
- Automated fanfare for Maiden Overs (`🔥 MAIDEN OVER!`).
- Boundary drought alerts (`⏳ Pressure mounting! 18 balls without a boundary` and `💥 Pressure released!`).
- Milestones: 50s, 100s, 50-run and 100-run partnerships, 5-wicket hauls.

### 6. 📜 MCC Laws Compliance
- **Free Hit State Machine**: No-balls trigger Free Hits; illegal dismissals (Bowled, Caught, LBW, Stumped, Hit Wicket) are negated; Free Hit carries over on wides/no-balls.
- **MCC Law 25.4 (Retired Hurt)**: Retired Hurt does not increment wickets lost; the batter vacates the crease not out.
- **100% Deterministic 1-Tap Undo**: Restores striker/non-striker positions, over transitions, and legal balls cleanly.

---

## 🏗️ Architecture

```
src/
├── app/                      # Expo Router screens
│   ├── (tabs)/               # Bottom tabs (Matches, Teams, New Match, Profile, Settings)
│   ├── auth/login.tsx        # International OTP authentication & guest flow
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
├── storage/                  # AsyncStorage persistent storage & default seed data
├── types/                    # Domain models & type definitions
└── utils/                    # Colors & stadium night theme tokens
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or bun

### Installation
```bash
# Clone the repository
git clone https://github.com/Ashish-331/cric.git
cd cric

# Install dependencies
npx expo install
```

### Running the App
```bash
# Start the Expo development server
npx expo start

# Open on Web
Press 'w' in terminal

# Open on iOS / Android
Scan the QR code with Expo Go (iOS Camera / Android Expo Go app)
```

---

## 🧪 Testing

The codebase includes comprehensive automated test suites covering rules logic, NRR calculations, ghost claiming, rollups, and end-to-end user journeys:

```bash
# Run all unit, rules, and E2E simulation tests
npm test

# Typecheck with TypeScript
npx tsc --noEmit

# Diagnose Expo configuration
npx expo-doctor
```

---

## 📄 License
MIT
