# RPGFit — Fitness Quest (Final Year Project)

## Project Overview
RPGFit is a gamified fitness mobile app built as a Final Year Project (FYP). Users receive daily
AI-generated exercise quests, track completions on a calendar, and consult an AI fitness advisor
called "The Oracle". The UX theme is dark/gold RPG pixel-art.

**Platform:** React Native (Expo) — Android primary, iOS supported
**Status:** Working prototype. Persistent storage, AI personalisation, and modular architecture are implemented.

---

## Tech Stack
| Layer | Technology |
|---|---|
| Framework | React Native 0.81 + Expo 54 |
| Language | JavaScript (JSX) — no TypeScript |
| Navigation | Custom screen state in App.js (no React Navigation library) |
| AI | Groq API — model `llama-3.3-70b-versatile` |
| Storage | AsyncStorage (`@react-native-async-storage/async-storage`) |
| Styling | Single centralised StyleSheet (`src/styles/styles.js`) |

---

## Build & Run Commands
```bash
npx expo start          # Start dev server (scan QR with Expo Go)
npx expo run:android    # Build and run on Android emulator/device
npx expo run:ios        # Build and run on iOS simulator
eas build --platform android --profile preview   # Build APK via EAS (always use --profile preview)
```

---

## Directory Structure
```
fitness-quest-fyp/
├── App.js                        # Root: navigation state, session history, AI fetch
├── app.json                      # Expo config (name, slug, version, orientation)
├── package.json
├── android/                      # Native Android build files
└── src/
    ├── config.js                 # GITIGNORED — Groq API key lives here
    ├── config.example.js         # Template — copy to config.js and add real key
    ├── constants/
    │   └── exercises.js          # EXERCISES array + getDailyExercise() fallback
    ├── utils/
    │   ├── ai.js                 # getAIExercise(), getOracleReply() — Groq API calls
    │   ├── calendar.js           # getCalendarDays(), getCompletedDaysForMonth(), MONTH_NAMES
    │   ├── calories.js           # estimateCalories(), getWeeklyCalories() from sessionHistory
    │   └── storage.js            # loadSessionHistory(), saveSessionHistory() via AsyncStorage
    ├── components/
    │   ├── CalorieChart.js       # 7-day bar chart driven by real sessionHistory
    │   ├── TimerDisplay.js       # Animated countdown timer for hold exercises
    │   └── RepCounter.js         # Tap-to-count rep tracker with animation
    ├── screens/
    │   ├── HomeScreen.js         # Daily quest card + CalorieChart
    │   ├── ActivityScreen.js     # Calendar of completed days + CalorieChart
    │   ├── OracleScreen.js       # AI chatbot interface
    │   ├── ExerciseScreen.js     # Workout execution (wraps TimerDisplay or RepCounter)
    │   └── FailedScreen.js       # Shown when user quits mid-session
    └── styles/
        └── styles.js             # All styles in one StyleSheet export `s`
```

---

## Architecture Decisions
- **No React Navigation library** — screen switching is done with a `screen` state string in `App.js`
- **Single stylesheet** — all styles live in `src/styles/styles.js`, exported as default `s`. Never use inline styles.
- **No Redux / Context API** — state is passed as props from `App.js` (sessionHistory, aiExercise, etc.)
- **AsyncStorage** — session history is the only persisted data. Loaded on mount, saved on every complete/fail.
- **API key isolation** — `src/config.js` is gitignored. New devs copy `src/config.example.js` → `src/config.js` and add their Groq key.

---

## Data Model

### sessionHistory entry
```js
{
  date: string,       // new Date().toLocaleDateString() — e.g. "15/03/2026"
  exercise: string,   // e.g. "Push-Ups"
  type: "reps" | "timer",
  target: number,     // reps count or seconds
  completed: boolean
}
```
Persisted under AsyncStorage key `@rpgfit:sessionHistory`.

### Exercise object (from AI or EXERCISES fallback)
```js
{
  name: string,
  type: "reps" | "timer",
  target: number,
  instructions: string
}
```

---

## AI Integration
- **Service:** Groq (`https://api.groq.com/openai/v1/chat/completions`)
- **Model:** `llama-3.3-70b-versatile`
- **Key location:** `EXPO_PUBLIC_GROQ_API_KEY` in `.env` (local/Expo Go) and **expo.dev dashboard** Environment Variables → Preview (EAS builds)
- **Exercise generation:** `getAIExercise()` in `App.js` — adapts difficulty based on history
- **Oracle chatbot:** inline in `App.js` OracleScreen — RPG "wise mentor" personality

### ⚠️ Groq API Key Rules — READ THIS
- **NEVER put the Groq key in eas.json** — the repo is public, GitHub will detect it and Groq will auto-revoke it
- The key for EAS builds lives on **expo.dev** → project → Environment Variables → Preview
- The key for local/Expo Go lives in `.env` (gitignored)
- If the Oracle stops working in the APK but works in Expo Go:
  1. Go to console.groq.com and check if the key is revoked
  2. If revoked, create a new key and update it on expo.dev dashboard (NOT in eas.json)
  3. Run `eas env:list preview --scope project` to check for conflicting secrets
  4. If `EXPO_PUBLIC_GROQ_API_KEY` appears as a secret, delete it: `eas env:delete preview --variable-name EXPO_PUBLIC_GROQ_API_KEY --scope project`
  5. Rebuild the APK

---

## Coding Conventions
- Functional components only — no class components
- Import styles as `import s from "../styles/styles"` — never write inline style objects
- Screens receive only the props they need (passed down from App.js)
- Utils are pure functions — no side effects outside `storage.js`
- File naming: PascalCase for components/screens, camelCase for utils

---

## Current State & Known Placeholders
| Feature | Status |
|---|---|
| Session history persistence | Done (AsyncStorage) |
| AI exercise generation | Done (Groq) |
| Oracle chatbot | Done (Groq) |
| Activity calendar (real data) | Done |
| Calorie chart (real data) | Done |
| User profile (weight/height/age) | Placeholder — `userProfile` is always `null` |
| Exercise demo video | Placeholder — shows "Video coming soon" |
| User authentication | Removed — app is fully open/public |
| XP / levelling system | UI references exist but not implemented |
| React Native Maps | Imported in package.json but unused |
