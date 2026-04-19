import { useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./lib/supabase";
import * as Linking from "expo-linking";
import { Video, ResizeMode } from "expo-av";
import * as Location from "expo-location";
import {
  WALK_COMPLETION_RADIUS_M,
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsViewerUrl,
  buildWalkSessionEntry,
  clearActiveWalkState,
  computeWalkProgress,
  destinationPoint,
  formatDistance,
  formatElapsedTime,
  haversineDistance,
  loadActiveWalkState,
  saveActiveWalkState,
} from "./src/utils/walk";

/*
Plain-English file guide:
1. Imports and static data: external services, built-in exercises, rewards.
2. Helper functions: calories, calendar, AI workout generation, XP/streak logic.
3. Screen components: login, onboarding, home, progress, Oracle, exercise flow, walk, profile.
4. App(): the real entry point. It loads data, controls navigation, and wires all screens together.
5. Styles: the big StyleSheet at the bottom used by every screen above.
*/

import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Modal,
  Animated,
  Easing,
  BackHandler,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Image,
} from "react-native";

// ── Groq API (Llama) ──
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// ── Sample exercises (AI will control reps/duration later) ──
const EXERCISES = [
  {
    id: 1,
    name: "Push-Ups",
    type: "reps",
    target: 15,
    instructions:
      "Place your hands shoulder-width apart on the floor. Keep your body in a straight line from head to heels. Lower your chest until it nearly touches the floor, then push back up. Keep your core tight and breathe steadily throughout.\n\nCan't do a push-up yet? Try a wall push-up: Stand facing a wall, about arm's length away. Place your hands flat on the wall at shoulder height and shoulder-width apart. Bend your elbows and lean your chest toward the wall, then push yourself back to the start. Keep your body straight and core tight — same movement, easier on your muscles.",
    videoUrl: "https://soemtmcjtuemwomzmraj.supabase.co/storage/v1/object/public/exercise%20videos/pushups.mp4",
  },
  {
    id: 2,
    name: "Plank",
    type: "timer",
    target: 60,
    instructions:
      "Start in a forearm plank position with elbows directly under your shoulders. Keep your body in a straight line — don't let your hips sag or pike up. Engage your core and glutes. Breathe normally and hold the position for the full duration.",
    videoUrl: "https://soemtmcjtuemwomzmraj.supabase.co/storage/v1/object/public/exercise%20videos/plank.mp4",
  },
  {
    id: 3,
    name: "Jumping Jacks",
    type: "reps",
    target: 30,
    instructions:
      "Stand upright with your feet together and arms at your sides. Jump your feet out to shoulder-width while raising your arms above your head. Jump back to the starting position and repeat. Keep a steady rhythm and land softly on the balls of your feet.",
    videoUrl: "https://soemtmcjtuemwomzmraj.supabase.co/storage/v1/object/public/exercise%20videos/jumping-jacks.mp4",
  },
  {
    id: 4,
    name: "High Knees",
    type: "timer",
    target: 45,
    instructions:
      "Stand tall and run in place, driving your knees up to hip height with each step. Pump your arms in sync with your legs. Keep your core tight and land softly on the balls of your feet. Maintain a fast, steady pace throughout.",
    videoUrl: "https://soemtmcjtuemwomzmraj.supabase.co/storage/v1/object/public/exercise%20videos/high-knees.mp4",
  },
  {
    id: 5,
    name: "Squat Jumps",
    type: "reps",
    target: 15,
    instructions:
      "Stand with feet shoulder-width apart. Lower into a squat position, then explode upward jumping as high as you can. Land softly back into the squat position with bent knees to absorb the impact. Keep your chest up and core engaged throughout.",
    videoUrl: "https://soemtmcjtuemwomzmraj.supabase.co/storage/v1/object/public/exercise%20videos/squat-jumps.mp4",
  },
];

// ── Weapon badge system ──
const WEAPONS = [
  { id: 'stick',     name: 'Wooden Stick',    unlockLevel: 1,  rarity: 'COMMON',    rarityColor: '#888888', image: require('./assets/weapons/stick.png') },
  { id: 'dagger',    name: 'Iron Dagger',     unlockLevel: 3,  rarity: 'COMMON',    rarityColor: '#AAAAAA', image: require('./assets/weapons/dagger.png') },
  { id: 'sword',     name: 'Iron Sword',      unlockLevel: 6,  rarity: 'UNCOMMON',  rarityColor: '#55AA55', image: require('./assets/weapons/sword.png') },
  { id: 'axe',       name: 'Battle Axe',      unlockLevel: 10, rarity: 'UNCOMMON',  rarityColor: '#55AA55', image: require('./assets/weapons/axe.png') },
  { id: 'staff',     name: 'Wizard Staff',    unlockLevel: 15, rarity: 'RARE',      rarityColor: '#5588FF', image: require('./assets/weapons/staff.png') },
  { id: 'goldsword', name: 'Golden Sword',    unlockLevel: 20, rarity: 'RARE',      rarityColor: '#FFD700', image: require('./assets/weapons/goldsword.png') },
  { id: 'trident',   name: 'Sea Trident',     unlockLevel: 25, rarity: 'EPIC',      rarityColor: '#AA55FF', image: require('./assets/weapons/trident.png') },
  { id: 'crystal',   name: 'Crystal Blade',   unlockLevel: 35, rarity: 'EPIC',      rarityColor: '#00FFFF', image: require('./assets/weapons/crystal.png') },
  { id: 'legend',    name: 'Legendary Blade', unlockLevel: 50, rarity: 'LEGENDARY', rarityColor: '#FF8C00', image: require('./assets/weapons/legend.png') },
];

// ── Calorie estimation from session data ──
const EXERCISE_MET = {
  "Push-Ups": 3.8, "Jumping Jacks": 7.5, "Squat Jumps": 11.0,
  "Plank": 2.8, "High Knees": 7.5,
};
const SECS_PER_REP = {
  "Push-Ups": 3.0, "Jumping Jacks": 1.0, "Squat Jumps": 2.5,
};
const DEFAULT_WEIGHT_KG = 70;
const DEFAULT_MET = 5.0;

function estimateCalories(session, weightKg = DEFAULT_WEIGHT_KG) {
  // Converts one saved exercise entry into an estimated calorie burn value.
  // Repetition exercises are first approximated into duration, then both
  // reps and timer exercises use a MET-style energy formula.
  const met = EXERCISE_MET[session.exercise] ?? DEFAULT_MET;
  const weight = weightKg ?? DEFAULT_WEIGHT_KG;
  const durationHours = session.type === "reps"
    ? (session.target * (SECS_PER_REP[session.exercise] ?? 2.0)) / 3600
    : session.target / 3600;
  return met * weight * durationHours;
}

function estimateWalkCalories(walk, weightKg = DEFAULT_WEIGHT_KG) {
  // Estimates calories for walking sessions using the recorded duration in seconds.
  const WALK_MET = 3.5;
  const weight = weightKg ?? DEFAULT_WEIGHT_KG;
  const durationHours = walk.duration_s / 3600;
  return WALK_MET * weight * durationHours;
}

function getCalorieData(sessionHistory, weightKg, walkHistory = [], weekOffset = 0) {
  // Aggregates exercise and walking calories into a 7-day chart window.
  // weekOffset 0 means the current week window ending today, 1 means the previous 7-day window, etc.
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (weekOffset * 7) - (6 - i));
    const dateStr = date.toISOString().split("T")[0];
    const exerciseCal = sessionHistory
      .filter((s) => s.date === dateStr)
      .reduce((sum, s) => sum + estimateCalories(s, weightKg), 0);
    const walkCal = walkHistory
      .filter((w) => w.date === dateStr)
      .reduce((sum, w) => sum + estimateWalkCalories(w, weightKg), 0);
    return { day: DAY_NAMES[date.getDay()], cal: Math.round(exerciseCal + walkCal), date: dateStr };
  });
}

function formatChartRange(data) {
  if (!data || data.length === 0) return "Last 7 days";
  const start = new Date(data[0].date);
  const end = new Date(data[data.length - 1].date);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const endLabel = end.toLocaleDateString("en-GB", sameMonth ? { day: "numeric", month: "short" } : { day: "numeric", month: "short" });
  return `${startLabel} - ${endLabel}`;
}

// ── Calendar helper ──
function getCalendarDays(year, month) {
  // Builds the padded month grid for the progress calendar.
  // Null entries at the start offset day 1 to the correct weekday column.
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];


function getDailyExercises() {
  // Local fallback workout rotation used when no AI-generated plan is available.
  const base = new Date().getDate();
  return Array.from({ length: 5 }, (_, i) => EXERCISES[(base + i) % EXERCISES.length]);
}

// ── Ask Llama AI for today's 5-exercise session ──
async function getAIExercise(sessionHistory, userProfile, difficultyModifiers = {}) {
  // Sends the user's recent history, profile, and difficulty hints to Groq,
  // then validates the returned JSON before merging it with local exercise metadata.
  const historyText = sessionHistory.length === 0
    ? "This is the user's first session ever. Start them off easy."
    : sessionHistory.slice(-20).map((s, i) =>
        `Session ${i + 1} (${s.date}): ${s.exercise} — ${s.completed ? "Completed" : "Failed"}${s.type === "reps" ? `, ${s.target} reps` : `, ${s.target}s hold`}`
      ).join("\n");

  const profileText = userProfile
    ? `\nUser profile: Weight ${userProfile.weight}kg, Height ${userProfile.height}cm, Age ${userProfile.age} years old.\n`
    : "";

  const diffText = Object.keys(difficultyModifiers).length > 0
    ? `\nDifficulty modifiers based on recent performance (last 5 attempts per exercise):\n` +
      Object.entries(difficultyModifiers).map(([name, d]) =>
        `- ${name}: ${d.modifier === 'reduce' ? 'REDUCE difficulty ~20% (user is struggling)' : d.modifier === 'increase' ? 'INCREASE difficulty (user is excelling)' : 'keep normal difficulty'} — ${d.successRate}% success rate over ${d.recentAttempts} attempts`
      ).join("\n") + "\n"
    : "";

  const prompt = `You are a fitness coach AI for the RPGFit app. Based on the user's exercise history and profile, create a 5-exercise session for today.
${profileText}${diffText}
Available exercises: Push-Ups (reps), Plank (timer/seconds), Jumping Jacks (reps), High Knees (timer/seconds), Squat Jumps (reps).

Rules:
- If the user is new or coming back from failures, go easy (lower reps/duration)
- If the user has been completing sessions consistently, gradually increase difficulty
- Push-Ups: range 5-50 reps. Plank: range 15-120 seconds. Jumping Jacks: range 10-60 reps. High Knees: range 15-90 seconds. Squat Jumps: range 5-30 reps.
- Vary the exercises across the 5 — include a good mix
- Apply the difficulty modifiers above if provided
- Consider the user's streak and recent performance

User's session history:
${historyText}

Respond ONLY with valid JSON — an array of exactly 5 exercises, no extra text:
[{"name":"Exercise Name","type":"reps or timer","target":number},...]`;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length === 5 &&
          parsed.every(e => e.name && e.type && e.target)) {
        // Merge with EXERCISES array to always use our full instructions + videoUrl
        return parsed.map(e => {
          const base = EXERCISES.find(x => x.name === e.name);
          return {
            ...e,
            instructions: base?.instructions ?? e.instructions ?? '',
            videoUrl: base?.videoUrl ?? null,
          };
        });
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}

// ── XP / Streak helpers ──
function calculateXP(exercise) {
  // Basic progression rule for completed exercises.
  if (exercise.type === "reps") return exercise.target * 2;
  return exercise.target * 1;
}

function groupWorkoutSessions(sessionHistory) {
  // Groups nearby exercise records into workout-sized bundles so progress history
  // reads like sessions rather than isolated database rows.
  const sorted = [...sessionHistory].sort((a, b) => {
    const aTime = new Date(a.created_at || a.date).getTime();
    const bTime = new Date(b.created_at || b.date).getTime();
    return bTime - aTime;
  });

  const groups = [];
  for (const entry of sorted) {
    const entryTime = new Date(entry.created_at || entry.date).getTime();
    const entryDay = entry.date;
    const lastGroup = groups[groups.length - 1];

    const shouldMerge =
      lastGroup &&
      lastGroup.date === entryDay &&
      entry.created_at &&
      lastGroup.hasPreciseTime &&
      Math.abs(lastGroup.anchorTime - entryTime) <= 10 * 1000;

    if (shouldMerge) {
      lastGroup.items.push(entry);
      lastGroup.completed = lastGroup.completed && entry.completed;
      if (entry.completed) {
        lastGroup.xp += calculateXP(entry);
      }
      continue;
    }

    groups.push({
      date: entryDay,
      anchorTime: entryTime,
      hasPreciseTime: Boolean(entry.created_at),
      items: [entry],
      completed: entry.completed,
      xp: entry.completed ? calculateXP(entry) : 0,
    });
  }

  return groups.slice(0, 10).map((group) => ({
    ...group,
    summary: group.items.map((item) => item.exercise).join(" • "),
  }));
}

function computeUpdatedProfile(profile, xpEarned, todayStr) {
  // Applies XP and streak changes after a successful session.
  // This is the central place where progression data is recalculated.
  const last = profile.last_session_date;
  let newStreak = 1;
  if (last) {
    const diffDays = Math.round(
      (new Date(todayStr).getTime() - new Date(last).getTime()) / 86_400_000
    );
    if (diffDays === 1) newStreak = profile.streak + 1;
    else if (diffDays === 0) newStreak = profile.streak;
    else newStreak = 1;
  }
  return {
    xp: profile.xp + xpEarned,
    streak: newStreak,
    best_streak: Math.max(profile.best_streak, newStreak),
    last_session_date: todayStr,
  };
}

// ── Adaptive difficulty: analyse last 5 attempts per exercise ──
function computeExerciseDifficulty(sessionHistory) {
  // Looks at the most recent attempts for each exercise and produces a small
  // modifier object that tells the AI whether to reduce, keep, or increase difficulty.
  const byExercise = {};
  for (const s of [...sessionHistory].reverse()) {
    if (!byExercise[s.exercise]) byExercise[s.exercise] = [];
    if (byExercise[s.exercise].length < 5) byExercise[s.exercise].push(s);
  }
  const modifiers = {};
  for (const [name, sessions] of Object.entries(byExercise)) {
    if (sessions.length === 0) continue;
    const fails = sessions.filter(s => !s.completed).length;
    const total = sessions.length;
    let modifier = 'normal';
    if (fails >= 2) modifier = 'reduce';
    else if (sessions.every(s => s.completed) && total >= 5) modifier = 'increase';
    modifiers[name] = { modifier, recentAttempts: total, successRate: Math.round(((total - fails) / total) * 100) };
  }
  return modifiers;
}

// ── Ask AI for a walk objective ──
async function getAIWalkObjective(userProfile) {
  // Requests a short walking goal from the AI and expects strict JSON in response.
  const profileText = userProfile
    ? `User: ${userProfile.fitness_level}, weight ${userProfile.weight}kg`
    : "User fitness level unknown";
  const prompt = `You are a fitness coach. Generate a short outdoor walk objective based on distance.
${profileText}
Respond ONLY with valid JSON — always distance-based:
{"text":"Walk 500 metres","type":"distance","value":500}
Distance range: 100-2000m. Adjust based on fitness level.`;
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 100,
      }),
    });
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    const match = content?.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.text && parsed.type && parsed.value) return parsed;
    }
  } catch (_) {}
  return { text: "Walk 500 metres", type: "distance", value: 500 };
}

// ══════════════════════════════════════════
//  CALORIE BAR CHART (shared component)
// ══════════════════════════════════════════
function CalorieChart({ title, data, weekOffset, onPrevWeek, onNextWeek }) {
  // Reusable visual component for weekly calorie totals.
  // It only renders prepared data and does not own any domain logic.
  const maxCal = Math.max(...data.map((d) => d.cal), 1);
  const total = data.reduce((sum, d) => sum + d.cal, 0);
  return (
    <View style={s.chartCard}>
      <View style={s.chartHeaderRow}>
        <View style={s.chartHeaderText}>
          <Text style={s.chartTitle}>{title || "Calories Burned"}</Text>
          <Text style={s.chartSubtitle}>{formatChartRange(data)}</Text>
        </View>
      </View>
      <View style={s.chartBodyRow}>
        <TouchableOpacity style={s.chartSideBtn} onPress={onPrevWeek} activeOpacity={0.8}>
          <Text style={s.chartNavText}>◀</Text>
        </TouchableOpacity>
        <View style={s.chartArea}>
          {data.map((item, i) => {
            const barH = (item.cal / maxCal) * 120;
            return (
              <View key={i} style={s.chartCol}>
                <Text style={s.chartVal}>{item.cal || ""}</Text>
                <View style={[s.chartBar, { height: Math.max(barH, item.cal > 0 ? 4 : 0) }]} />
                <Text style={s.chartLabel}>{item.day}</Text>
              </View>
            );
          })}
        </View>
        <TouchableOpacity
          style={[s.chartSideBtn, weekOffset === 0 && s.chartNavBtnDisabled]}
          onPress={onNextWeek}
          disabled={weekOffset === 0}
          activeOpacity={0.8}
        >
          <Text style={[s.chartNavText, weekOffset === 0 && s.chartNavTextDisabled]}>▶</Text>
        </TouchableOpacity>
      </View>
      <View style={s.chartTotalRow}>
        <Text style={s.chartTotalLabel}>Total this week</Text>
        <Text style={s.chartTotalValue}>{total} kcal</Text>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════
//  AUTH SCREEN (login / sign up)
// ══════════════════════════════════════════
function LoginScreen({ mode, onToggleMode, onLogin, onSignup, loading, error, verificationSent, onBackToLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = () => {
    if (!email.trim() || !password.trim()) return;
    if (mode === 'login') onLogin(email.trim(), password);
    else onSignup(email.trim(), password);
  };

  // ── Email verification sent ──
  if (verificationSent) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />
        <View style={s.verifyContainer}>
          <Text style={s.verifyEmoji}>📬</Text>
          <Text style={s.verifyTitle}>CHECK YOUR EMAIL</Text>
          <Text style={s.verifyBody}>
            We sent a verification link to your inbox. Click it to activate your account, then come back here to log in.
          </Text>
          <TouchableOpacity style={s.primaryBtn} onPress={onBackToLogin} activeOpacity={0.85}>
            <Text style={s.primaryBtnText}>BACK TO LOGIN</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />
      <ScrollView contentContainerStyle={s.authScroll} keyboardShouldPersistTaps="handled">
        <View style={s.authLogoWrap}>
          <View style={s.authLogoCircle}>
            <Text style={s.authLogoEmoji}>⚔️</Text>
          </View>
          <Text style={s.authLogoTitle}>RPGFIT</Text>
          <Text style={s.authLogoSub}>Your daily quest awaits</Text>
        </View>

        <View style={s.authCard}>
          <Text style={s.authCardTitle}>
            {mode === 'login' ? 'ENTER THE REALM' : 'CREATE YOUR HERO'}
          </Text>

          {error ? <Text style={s.authError}>{error}</Text> : null}

          <Text style={s.inputLabel}>EMAIL</Text>
          <TextInput
            style={s.input}
            placeholder="adventurer@example.com"
            placeholderTextColor="#555555"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            editable={!loading}
          />

          <Text style={s.inputLabel}>PASSWORD</Text>
          <View style={s.passwordRow}>
            <TextInput
              style={s.inputPassword}
              placeholder="********"
              placeholderTextColor="#555555"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
              editable={!loading}
            />
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(!showPass)}>
              <Text style={s.eyeText}>{showPass ? 'HIDE' : 'SHOW'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[s.primaryBtn, loading && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator size="small" color="#0A0A0A" />
              : <Text style={s.primaryBtnText}>
                  {mode === 'login' ? 'LOGIN' : 'CREATE ACCOUNT'}
                </Text>
            }
          </TouchableOpacity>
        </View>

        <View style={s.authFooter}>
          <TouchableOpacity onPress={() => onToggleMode(mode === 'login' ? 'signup' : 'login')} disabled={loading}>
            <Text style={s.authFooterText}>
              {mode === 'login' ? "No account? " : "Already a hero? "}
              <Text style={s.authFooterLink}>
                {mode === 'login' ? 'Sign Up' : 'Log In'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════
//  ONBOARDING SCREEN
// ══════════════════════════════════════════
function OnboardingScreen({ onComplete, loading, error }) {
  // First-run setup that collects the profile fields used throughout the app
  // for AI personalisation, calorie estimates, and progression displays.
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState('beginner');

  const handleSubmit = () => {
    if (!name.trim()) return;
    onComplete({
      display_name: name.trim(),
      age: parseInt(age) || 0,
      weight: parseFloat(weight) || 0,
      height: parseInt(height) || 0,
      fitness_level: fitnessLevel,
    });
  };

  const levels = [
    { key: 'beginner', label: 'Beginner' },
    { key: 'intermediate', label: 'Intermediate' },
    { key: 'advanced', label: 'Advanced' },
  ];

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />
      <ScrollView contentContainerStyle={s.authScroll} keyboardShouldPersistTaps="handled">
        <View style={s.authLogoWrap}>
          <View style={s.authLogoCircle}>
            <Text style={s.authLogoEmoji}>⚔️</Text>
          </View>
          <Text style={s.authLogoTitle}>RPGFIT</Text>
          <Text style={s.onboardingDesc}>Tell us about yourself so we can personalise your quests.</Text>
        </View>

        <View style={s.authCard}>
          <Text style={s.authCardTitle}>CREATE YOUR HERO</Text>
          {error ? <Text style={s.authError}>{error}</Text> : null}

          <Text style={s.inputLabel}>DISPLAY NAME</Text>
          <TextInput style={s.input} placeholder="Adventurer" placeholderTextColor="#555" value={name} onChangeText={setName} editable={!loading} />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.inputLabel}>AGE</Text>
              <TextInput style={s.input} placeholder="25" placeholderTextColor="#555" value={age} onChangeText={setAge} keyboardType="numeric" editable={!loading} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.inputLabel}>WEIGHT (kg)</Text>
              <TextInput style={s.input} placeholder="70" placeholderTextColor="#555" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" editable={!loading} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.inputLabel}>HEIGHT (cm)</Text>
              <TextInput style={s.input} placeholder="175" placeholderTextColor="#555" value={height} onChangeText={setHeight} keyboardType="numeric" editable={!loading} />
            </View>
          </View>

          <Text style={s.inputLabel}>FITNESS LEVEL</Text>
          <View style={s.fitnessBtnRow}>
            {levels.map((l) => (
              <TouchableOpacity
                key={l.key}
                style={[s.fitnessBtnBase, fitnessLevel === l.key ? s.fitnessBtnActive : s.fitnessBtnInactive]}
                onPress={() => setFitnessLevel(l.key)}
              >
                <Text style={[s.fitnessBtnText, fitnessLevel === l.key && s.fitnessBtnTextActive]}>{l.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[s.primaryBtn, (!name.trim() || loading) && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={!name.trim() || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator size="small" color="#0A0A0A" />
              : <Text style={s.primaryBtnText}>BEGIN QUEST</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════
//  HOME SCREEN
// ══════════════════════════════════════════
function HomeScreen({ onStart, aiExercise, aiLoading, sessionHistory, walkHistory, onLogout, userProfile }) {
  // Main dashboard shown after auth and onboarding.
  // It surfaces the daily quest, the user's current progression state, and the weekly chart.
  const [weekOffset, setWeekOffset] = useState(0);
  const exerciseList = Array.isArray(aiExercise) ? aiExercise : (aiExercise ? [aiExercise] : getDailyExercises());
  const firstExercise = exerciseList[0];
  const level = userProfile ? Math.floor(userProfile.xp / 200) + 1 : 1;
  const calorieData = getCalorieData(sessionHistory, userProfile?.weight, walkHistory, weekOffset);

  return (
    <ScrollView style={s.scrollRoot} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={s.headerRow}>
        <View>
          <Text style={s.appTitle}>RPGFit</Text>
          <Text style={s.appSubtitle}>
            {userProfile ? `Welcome back, ${userProfile.display_name || 'Adventurer'}` : 'Your daily quest awaits'}
          </Text>
        </View>
        <TouchableOpacity style={s.logoutCircle} onPress={onLogout} activeOpacity={0.8}>
          <Text style={s.logoutCircleText}>⏻</Text>
        </TouchableOpacity>
      </View>

      {userProfile && (
        <View style={s.xpBadgeRow}>
          <View style={s.xpBadgePill}>
            <Text style={s.xpBadgeText}>🔥 {userProfile.streak} day streak</Text>
          </View>
          <View style={s.xpBadgePill}>
            <Text style={s.xpBadgeText}>⚡ LV{level} · {userProfile.xp} XP</Text>
          </View>
        </View>
      )}

      <TouchableOpacity style={s.sessionCard} onPress={onStart} activeOpacity={0.85} disabled={aiLoading}>
        <View style={s.sessionLeft}>
          <View style={s.sessionIconWrap}>
            {aiLoading ? (
              <ActivityIndicator size="small" color="#FFD700" />
            ) : (
              <Text style={s.sessionIcon}>⚔️</Text>
            )}
          </View>
        </View>
        <View style={s.sessionRight}>
          <Text style={s.sessionLabel}>
            {aiExercise ? "AI-POWERED QUEST" : "TODAY'S QUEST"}
          </Text>
          <Text style={s.sessionTitle}>5-Exercise Session</Text>
          {aiLoading ? (
            <Text style={s.sessionDesc}>AI is preparing your workout...</Text>
          ) : (
            <Text style={s.sessionDesc}>
              Starts with {firstExercise.name} · {exerciseList.length} exercises total
            </Text>
          )}
          <View style={s.sessionStartRow}>
            <Text style={s.sessionStartText}>{aiLoading ? "Loading..." : "Tap to begin >"}</Text>
          </View>
        </View>
      </TouchableOpacity>

      <CalorieChart
        title="Calories Burned"
        data={calorieData}
        weekOffset={weekOffset}
        onPrevWeek={() => setWeekOffset((prev) => prev + 1)}
        onNextWeek={() => setWeekOffset((prev) => Math.max(prev - 1, 0))}
      />
    </ScrollView>
  );
}

// ══════════════════════════════════════════
//  PROGRESS SCREEN
// ══════════════════════════════════════════
function ProgressScreen({ sessionHistory, userProfile, walkHistory }) {
  // Progress/analytics screen.
  // It transforms raw session and walking history into summary stats, calendar highlights,
  // recent workouts, and cumulative activity views.
  const now = new Date();
  const [weekOffset, setWeekOffset] = useState(0);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const today = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const days = getCalendarDays(year, month);
  const completedDays = new Set([
    ...sessionHistory
      .filter((s) => s.completed)
      .map((s) => new Date(s.date))
      .filter((d) => d.getFullYear() === year && d.getMonth() === month)
      .map((d) => d.getDate()),
    ...(walkHistory || [])
      .filter((walk) => walk.completed)
      .map((walk) => new Date(walk.date))
      .filter((d) => d.getFullYear() === year && d.getMonth() === month)
      .map((d) => d.getDate()),
  ]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1);
  };

  // Stats (walks count as sessions)
  const totalSessions = sessionHistory.length + (walkHistory?.length ?? 0);
  const completedSessions = sessionHistory.filter((s) => s.completed).length + (walkHistory?.filter((w) => w.completed).length ?? 0);
  const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
  const level = userProfile ? Math.floor(userProfile.xp / 200) + 1 : 1;
  const recentSessions = groupWorkoutSessions(sessionHistory);
  const calorieData = getCalorieData(sessionHistory, userProfile?.weight, walkHistory, weekOffset);

  const statCards = [
    { label: 'Sessions', value: totalSessions },
    { label: 'Completion', value: `${completionRate}%` },
    { label: 'Streak', value: `${userProfile?.streak ?? 0}🔥` },
    { label: 'Total XP', value: userProfile?.xp ?? 0 },
    { label: 'Best Streak', value: userProfile?.best_streak ?? 0 },
    { label: 'Level', value: `LV${level}` },
  ];

  return (
    <ScrollView style={s.scrollRoot} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={s.header}>
        <Text style={s.appTitle}>Progress</Text>
        <Text style={s.appSubtitle}>Your journey so far</Text>
      </View>

      {/* Stats cards */}
      <View style={s.statsGrid}>
        {statCards.map((c, i) => (
          <View key={i} style={s.statCard}>
            <Text style={s.statValue}>{c.value}</Text>
            <Text style={s.statLabel}>{c.label}</Text>
          </View>
        ))}
      </View>

      {/* Calendar */}
      <View style={s.calendarCard}>
        <View style={s.calNavRow}>
          <TouchableOpacity onPress={prevMonth} style={s.calNavBtn}>
            <Text style={s.calNavText}>◀</Text>
          </TouchableOpacity>
          <Text style={s.calMonthTitle}>{MONTH_NAMES[month]} {year}</Text>
          <TouchableOpacity onPress={nextMonth} style={s.calNavBtn}>
            <Text style={s.calNavText}>▶</Text>
          </TouchableOpacity>
        </View>
        <View style={s.calRow}>
          {DAY_HEADERS.map((d) => (
            <View key={d} style={s.calCell}>
              <Text style={s.calDayHeader}>{d}</Text>
            </View>
          ))}
        </View>
        <View style={s.calGrid}>
          {days.map((day, i) => {
            const isToday = isCurrentMonth && day === today;
            const isCompleted = day && completedDays.has(day);
            return (
              <View key={i} style={s.calCell}>
                {day ? (
                  <View style={[s.calDayCircle, isToday && s.calDayToday, isCompleted && s.calDayCompleted]}>
                    <Text style={[s.calDayText, isToday && s.calDayTextToday, isCompleted && !isToday && s.calDayTextCompleted]}>{day}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
        <View style={s.calLegend}>
          <View style={s.calLegendItem}>
            <View style={[s.calLegendDot, { backgroundColor: "#FFD700" }]} />
            <Text style={s.calLegendText}>Today</Text>
          </View>
          <View style={s.calLegendItem}>
            <View style={[s.calLegendDot, { backgroundColor: "#FFD700", borderWidth: 1, borderColor: "#B8860B" }]} />
            <Text style={s.calLegendText}>Completed</Text>
          </View>
        </View>
      </View>

      <CalorieChart
        title="Calorie Loss Overview"
        data={calorieData}
        weekOffset={weekOffset}
        onPrevWeek={() => setWeekOffset((prev) => prev + 1)}
        onNextWeek={() => setWeekOffset((prev) => Math.max(prev - 1, 0))}
      />

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <View style={s.chartCard}>
          <Text style={s.chartTitle}>Recent Sessions</Text>
          <Text style={s.chartSubtitle}>Last 10 workouts</Text>
          <ScrollView style={s.sessionScrollBox} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {recentSessions.map((s2, i) => (
              <View key={i} style={s.recentRow}>
                <View style={s.recentLeft}>
                  <Text style={s.recentExercise}>
                    Session {recentSessions.length - i}
                  </Text>
                  <Text style={s.recentDate}>{s2.date}</Text>
                  <Text style={s.recentDetails}>
                    {s2.items.length} exercise{s2.items.length === 1 ? "" : "s"}
                  </Text>
                  <Text style={s.recentSummary}>{s2.summary}</Text>
                </View>
                <View style={s.recentRight}>
                  <Text style={s2.completed ? s.recentBadgeWin : s.recentBadgeFail}>
                    {s2.completed ? '✓ Passed' : '✗ Failed'}
                  </Text>
                  <Text style={s.recentXp}>{s2.completed ? `+${s2.xp} XP` : '0 XP'}</Text>
                  <Text style={[s.recentXp, { color: '#FFD700' }]}>
                    {Math.round(s2.items.reduce((sum, item) => sum + estimateCalories(item, userProfile?.weight), 0))} kcal
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Walk history */}
      {walkHistory && walkHistory.length > 0 && (
        <View style={s.chartCard}>
          <Text style={s.chartTitle}>Walk History</Text>
          <Text style={s.chartSubtitle}>Last 10 walks</Text>
          <ScrollView style={s.sessionScrollBox} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {walkHistory.slice(0, 10).map((walk, i) => {
              const distStr = walk.distance_m >= 1000
                ? `${(walk.distance_m / 1000).toFixed(2)}km`
                : `${Math.round(walk.distance_m)}m`;
              const mins = Math.floor(walk.duration_s / 60);
              const secs = String(walk.duration_s % 60).padStart(2, '0');
              return (
                <View key={i} style={s.recentRow}>
                  <View style={s.recentLeft}>
                    <Text style={s.recentExercise}>Walk {walkHistory.length - i}</Text>
                    <Text style={s.recentDate}>{walk.date}</Text>
                    <Text style={s.recentDetails}>{walk.objective}</Text>
                    <Text style={s.recentSummary}>{distStr} | {mins}:{secs} | {Math.round(estimateWalkCalories(walk, userProfile?.weight))} kcal</Text>
                  </View>
                  <View style={s.recentRight}>
                    <Text style={walk.completed ? s.recentBadgeWin : s.recentBadgeFail}>
                      {walk.completed ? 'Done' : 'Incomplete'}
                    </Text>
                    <Text style={s.recentXp}>{walk.xp_earned > 0 ? `+${walk.xp_earned} XP` : '0 XP'}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );
}

// ══════════════════════════════════════════
//  ORACLE CHATBOT SCREEN
// ══════════════════════════════════════════
function OracleScreen({ sessionHistory, userProfile }) {
  // Chat surface for the in-app AI coach.
  // Messages live locally in this component while session history and profile
  // are injected into the prompt to keep replies personalised.
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Greetings, adventurer! I am the Oracle — your guide on this fitness quest. Ask me anything about exercise, nutrition, recovery, or wellbeing. I'm here to help you on your journey!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    // Build context with session history
    const historyContext = sessionHistory.length > 0
      ? "\n\nUser's recent exercise history:\n" +
        sessionHistory.slice(-10).map((s, i) =>
          `${s.date}: ${s.exercise} (${s.type === "reps" ? s.target + " reps" : s.target + "s"}) — ${s.completed ? "Completed" : "Failed"}`
        ).join("\n")
      : "\nThe user is new and hasn't completed any sessions yet.";

    const profileContext = userProfile
      ? `\nUser profile: Weight ${userProfile.weight}kg, Height ${userProfile.height}cm, Age ${userProfile.age} years old.`
      : "";

    const systemPrompt = `You are "The Oracle", a wise and encouraging fitness advisor in the RPGFit app — a gamified fitness quest app. Your personality is warm, motivating, and slightly mystical (like a wise RPG mentor).
${profileContext}

Your role:
- Give advice on exercise form, routines, and progression
- Help with nutrition, hydration, sleep, and recovery
- Provide motivation and encouragement
- Answer health and wellbeing questions
- Reference the user's exercise history when relevant to give personalised advice
- Keep responses concise (2-4 sentences usually) unless the user asks for detail
- Use encouraging, quest-themed language occasionally (adventurer, quest, journey, etc.) but don't overdo it
- Never give medical diagnoses — suggest seeing a doctor for medical concerns
${historyContext}`;

    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            ...updated.map((m) => ({ role: m.role, content: m.content })),
          ],
          temperature: 0.8,
          max_tokens: 500,
        }),
      });

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "The Oracle could not answer that right now. Please try again." }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "The Oracle is unavailable right now. Check your connection and try again." }]);
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={s.oracleContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={s.oracleHeader}>
        <Text style={s.oracleTitle}>The Oracle</Text>
        <Text style={s.oracleSubtitle}>Your AI wellness guide</Text>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={s.oracleMessages}
        contentContainerStyle={s.oracleMessagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((msg, i) => (
          <View
            key={i}
            style={[
              s.msgBubble,
              msg.role === "user" ? s.msgUser : s.msgAssistant,
            ]}
          >
            {msg.role === "assistant" && (
              <Text style={s.msgSender}>Oracle</Text>
            )}
            <Text style={[
              s.msgText,
              msg.role === "user" ? s.msgTextUser : s.msgTextAssistant,
            ]}>{msg.content}</Text>
          </View>
        ))}
        {loading && (
          <View style={[s.msgBubble, s.msgAssistant]}>
            <Text style={s.msgSender}>Oracle</Text>
            <ActivityIndicator size="small" color="#FFD700" style={{ alignSelf: "flex-start" }} />
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={s.oracleInputRow}>
        <TextInput
          style={s.oracleInput}
          placeholder="Ask the Oracle..."
          placeholderTextColor="#BBBBBB"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
          editable={!loading}
        />
        <TouchableOpacity
          style={[s.oracleSendBtn, (!input.trim() || loading) && { opacity: 0.4 }]}
          onPress={sendMessage}
          disabled={!input.trim() || loading}
          activeOpacity={0.7}
        >
          <Text style={s.oracleSendText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ══════════════════════════════════════════
//  ANIMATED TIMER
// ══════════════════════════════════════════
function TimerDisplay({ duration, onFinish }) {
  // Countdown UI used for timer-based exercises.
  // It runs the timer animation and signals the parent once the duration reaches zero.
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: duration * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${minutes}:${secs.toString().padStart(2, "0")}`;

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={s.timerContainer}>
      <Text style={s.timerLabel}>Hold for</Text>
      <Text style={s.timerValue}>{timeStr}</Text>
      <View style={s.progressTrack}>
        <Animated.View style={[s.progressFill, { width: progressWidth }]} />
      </View>
      <Text style={s.timerRemaining}>{secondsLeft}s remaining</Text>
    </View>
  );
}

// ══════════════════════════════════════════
//  REP COUNTER
// ══════════════════════════════════════════
function RepCounter({ target, onFinish }) {
  // Simple confirmation control for rep-based exercises.
  // The user completes the reps physically, then taps to confirm completion.
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(onFinish, 200);
    });
  };

  return (
    <View style={s.repContainer}>
      <Text style={s.repLabel}>Complete all reps, then confirm</Text>
      <Text style={[s.repTotal, { fontSize: 52, color: '#FFD700', marginBottom: 24 }]}>{target} reps</Text>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={s.repTouchable}>
        <Animated.View style={[s.repCircle, { transform: [{ scale }] }]}>
          <Text style={[s.repCount, { fontSize: 20, letterSpacing: 2 }]}>I DID IT</Text>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

// ══════════════════════════════════════════
//  EXERCISE SCREEN
// ══════════════════════════════════════════
function ExerciseScreen({ exercises, onComplete, onFail }) {
  // Active workout runner for a multi-exercise session.
  // It owns the current exercise index, rest-state transitions, exit handling,
  // and the list of exercises already completed in this run.
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState('exercise'); // 'exercise' | 'rest' | 'complete'
  const [restCountdown, setRestCountdown] = useState(15);
  const [completedList, setCompletedList] = useState([]);
  const [showExitModal, setShowExitModal] = useState(false);
  const restTimerRef = useRef(null);

  const exercise = exercises[currentIndex];
  const total = exercises.length;

  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (phase !== 'complete') { setShowExitModal(true); return true; }
      return false;
    });
    return () => handler.remove();
  }, [phase]);

  useEffect(() => {
    if (phase === 'rest') {
      setRestCountdown(15);
      restTimerRef.current = setInterval(() => {
        setRestCountdown(prev => {
          if (prev <= 1) {
            clearInterval(restTimerRef.current);
            advanceToNext();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(restTimerRef.current);
  }, [phase, currentIndex]);

  const advanceToNext = () => {
    clearInterval(restTimerRef.current);
    setCurrentIndex(i => i + 1);
    setPhase('exercise');
  };

  const handleExerciseFinish = () => {
    const updated = [...completedList, exercise];
    setCompletedList(updated);
    if (currentIndex < total - 1) {
      setPhase('rest');
    } else {
      setPhase('complete');
    }
  };

  const handleExit = () => {
    clearInterval(restTimerRef.current);
    setShowExitModal(false);
    onFail(exercise?.name, completedList);
  };

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      {phase !== 'complete' && (
        <TouchableOpacity style={s.backBtn} onPress={() => setShowExitModal(true)}>
          <Text style={s.backBtnText}>✕</Text>
        </TouchableOpacity>
      )}

      {/* Session progress bar */}
      <View style={s.sessionProgressBar}>
        <View style={[s.sessionProgressFill, { width: `${((phase === 'complete' ? total : currentIndex) / total) * 100}%` }]} />
      </View>
      <Text style={s.sessionProgressLabel}>
        {phase === 'complete' ? 'All Done!' : `Exercise ${currentIndex + 1} of ${total}`}
      </Text>

      {phase === 'exercise' && (
        <ScrollView contentContainerStyle={s.exerciseScroll} showsVerticalScrollIndicator={false}>
          <Text style={s.exerciseName}>{exercise.name}</Text>

          {exercise.videoUrl ? (
            <Video
              source={{ uri: exercise.videoUrl }}
              style={{ width: '100%', height: 220 }}
              resizeMode={ResizeMode.CONTAIN}
              isLooping
              isMuted
              shouldPlay
            />
          ) : (
            <View style={s.videoPlaceholder}>
              <Text style={s.videoIcon}>🎬</Text>
              <Text style={s.videoText}>Exercise Demo</Text>
              <Text style={s.videoSubtext}>Demo unavailable in this build</Text>
            </View>
          )}

          <View style={s.instructionsCard}>
            <Text style={s.instructionsTitle}>How to perform</Text>
            <Text style={s.instructionsBody}>{exercise.instructions}</Text>
          </View>

          {exercise.type === "timer" && (
            <TimerDisplay duration={exercise.target} onFinish={handleExerciseFinish} />
          )}
          {exercise.type === "reps" && (
            <RepCounter target={exercise.target} onFinish={handleExerciseFinish} />
          )}
        </ScrollView>
      )}

      {phase === 'rest' && (
        <View style={s.restScreen}>
          <Text style={s.restTitle}>REST</Text>
          <Text style={s.restCountdownNum}>{restCountdown}</Text>
          <Text style={s.restSubtitle}>Next: {exercises[currentIndex + 1]?.name}</Text>
          <TouchableOpacity style={s.restSkipBtn} onPress={advanceToNext} activeOpacity={0.8}>
            <Text style={s.restSkipBtnText}>SKIP REST</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'complete' && (
        <ScrollView contentContainerStyle={s.exerciseScroll} showsVerticalScrollIndicator={false}>
          <View style={s.doneSection}>
            <View style={s.doneIconCircle}>
              <Text style={s.doneIcon}>✓</Text>
            </View>
            <Text style={s.doneTitle}>Session Complete!</Text>
            <Text style={s.doneSubtitle}>
              Incredible work, adventurer. You conquered all {total} exercises!
            </Text>
            <TouchableOpacity style={s.doneBtn} onPress={() => onComplete(completedList)} activeOpacity={0.85}>
              <Text style={s.doneBtnText}>Claim Rewards & Return</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      <Modal visible={showExitModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalEmoji}>⚠️</Text>
            <Text style={s.modalTitle}>Abandon Session?</Text>
            <Text style={s.modalBody}>
              Leaving now will fail this exercise. No XP for this session. Are you sure?
            </Text>
            <TouchableOpacity style={s.modalBtnDanger} onPress={handleExit} activeOpacity={0.85}>
              <Text style={s.modalBtnDangerText}>Leave & Fail</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalBtnStay} onPress={() => setShowExitModal(false)} activeOpacity={0.85}>
              <Text style={s.modalBtnStayText}>Keep Going</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════
//  FAILED SCREEN
// ══════════════════════════════════════════
function FailedScreen({ onReturn }) {
  // Lightweight fallback screen shown after a failed or abandoned workout.
  return (
    <SafeAreaView style={s.root}>
      <View style={s.failContainer}>
        <Text style={s.failEmoji}>💀</Text>
        <Text style={s.failTitle}>Session Failed</Text>
        <Text style={s.failBody}>
          You left before completing the exercise. No XP earned this time. Come back stronger
          tomorrow!
        </Text>
        <TouchableOpacity style={s.failBtn} onPress={onReturn} activeOpacity={0.85}>
          <Text style={s.failBtnText}>Return Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════
//  WEB MAP (Leaflet via CDN — only used on web platform)

// ══════════════════════════════════════════
//  WALK SCREEN
// ══════════════════════════════════════════
function WalkScreen({ walkObjective, walkLoading, onWalkComplete, user, userProfile }) {
  // Outdoor walking mode.
  // It monitors GPS position, compares the current location with the generated destination,
  // and records the walk when the target distance/objective is achieved.
  const [tracking, setTracking] = useState(false);
  const [coords, setCoords] = useState([]);
  const [distanceM, setDistanceM] = useState(0);
  const [elapsedS, setElapsedS] = useState(0);
  const [walkDone, setWalkDone] = useState(false);
  const [walkResult, setWalkResult] = useState(null);
  const [permError, setPermError] = useState('');
  const [saving, setSaving] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [achieved, setAchieved] = useState(false);
  const [remainingM, setRemainingM] = useState(null);

  const locationSub = useRef(null);
  const timerRef = useRef(null);
  const saveStateRef = useRef(null);
  const lastCoordRef = useRef(null);
  const distanceRef = useRef(0);
  const elapsedRef = useRef(0);
  const destinationRef = useRef(null);
  const achievedRef = useRef(false);
  const finalizingRef = useRef(false);

  const persistWalkState = async () => {
    await saveActiveWalkState({
      tracking: true,
      distanceM: distanceRef.current,
      elapsedS: elapsedRef.current,
      destination: destinationRef.current,
      achieved: achievedRef.current,
      remainingM,
      lastCoord: lastCoordRef.current,
      walkObjective,
    });
  };

  // Get current location + restore any in-progress walk on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCurrentLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });

      // Restore walk state if app was killed mid-walk
      try {
        const saved = await loadActiveWalkState();
        if (saved?.tracking) {
            distanceRef.current = saved.distanceM;
            elapsedRef.current = saved.elapsedS;
            destinationRef.current = saved.destination;
            achievedRef.current = saved.achieved;
            lastCoordRef.current = saved.lastCoord;
            setDistanceM(saved.distanceM);
            setElapsedS(saved.elapsedS);
            setAchieved(saved.achieved);
            setTracking(true);
            setCurrentLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            if (saved.destination) {
              setRemainingM(haversineDistance({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }, saved.destination));
            }

            // Resume GPS tracking
            const sub = await Location.watchPositionAsync(
              { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 3000 },
              (l) => {
                const newCoord = { latitude: l.coords.latitude, longitude: l.coords.longitude };
                setCurrentLocation(newCoord);
                if (lastCoordRef.current) {
                  const delta = haversineDistance(lastCoordRef.current, newCoord);
                  if (delta > 1) {
                    lastCoordRef.current = newCoord;
                    distanceRef.current += delta;
                    setCoords((prev) => [...prev, newCoord]);
                    setDistanceM(distanceRef.current);
                  }
                  if (destinationRef.current && !achievedRef.current) {
                    const distToDest = haversineDistance(newCoord, destinationRef.current);
                    setRemainingM(distToDest);
                    if (distToDest <= WALK_COMPLETION_RADIUS_M && !finalizingRef.current) {
                      achievedRef.current = true;
                      setAchieved(true);
                      stopWalk(true);
                    }
                  }
                }
              }
            );
            locationSub.current = sub;
            timerRef.current = setInterval(() => {
              elapsedRef.current += 1;
              setElapsedS(elapsedRef.current);
            }, 1000);
            saveStateRef.current = setInterval(persistWalkState, 5000);
        }
      } catch (_) {}
    })();
    return () => {
      locationSub.current?.remove();
      clearInterval(timerRef.current);
      clearInterval(saveStateRef.current);
    };
  }, []);

  const startWalk = async () => {
    setPermError('');
    await clearActiveWalkState();
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { setPermError('Location permission denied. Please allow it in Settings.'); return; }

    const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const startCoord = { latitude: initial.coords.latitude, longitude: initial.coords.longitude };
    setCoords([startCoord]);
    lastCoordRef.current = startCoord;
    distanceRef.current = 0;
    elapsedRef.current = 0;
    setDistanceM(0);
    setElapsedS(0);
    setAchieved(false);
    setRemainingM(walkObjective?.type === 'distance' ? walkObjective.value : null);
    achievedRef.current = false;
    finalizingRef.current = false;
    destinationRef.current = null;
    setTracking(true);

    // Place destination marker and auto-open Google Maps with walking route
    if (walkObjective?.type === 'distance') {
      const bearing = Math.random() * 360;
      const dest = destinationPoint(startCoord, walkObjective.value, bearing);
      destinationRef.current = dest;
      const url = buildGoogleMapsDirectionsUrl(startCoord, dest);
      Linking.openURL(url);
    }

    const sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 3000 },
      (loc) => {
        const newCoord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setCurrentLocation(newCoord);
        if (lastCoordRef.current) {
          const delta = haversineDistance(lastCoordRef.current, newCoord);
          if (delta > 1) {
            lastCoordRef.current = newCoord;
            distanceRef.current += delta;
            setCoords((prev) => [...prev, newCoord]);
            setDistanceM(distanceRef.current);
          }
          // Check if user reached the destination (within 30m) using refs
          if (destinationRef.current && !achievedRef.current) {
            const distToDest = haversineDistance(newCoord, destinationRef.current);
            setRemainingM(distToDest);
            if (distToDest <= WALK_COMPLETION_RADIUS_M && !finalizingRef.current) {
              achievedRef.current = true;
              setAchieved(true);
              stopWalk(true);
            }
          }
        }
      }
    );
    locationSub.current = sub;

    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsedS(elapsedRef.current);
    }, 1000);

    // Save walk state every 5 seconds
    saveStateRef.current = setInterval(persistWalkState, 5000);
  };

  const stopWalk = async (forceComplete = false) => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    locationSub.current?.remove();
    clearInterval(timerRef.current);
    clearInterval(saveStateRef.current);
    await clearActiveWalkState();
    setTracking(false);
    setSaving(true);

    const isComplete = walkObjective
      ? walkObjective.type === 'distance'
        ? achievedRef.current
        : elapsedRef.current >= walkObjective.value
      : false;
    const xpEarned = isComplete ? Math.floor(distanceRef.current / 4) : 0;

    let savedEntry = null;
    if (user && walkObjective) {
      const entry = buildWalkSessionEntry(
        user.id,
        walkObjective,
        distanceRef.current,
        elapsedRef.current,
        xpEarned,
        isComplete,
        coords
      );
      const { data } = await supabase.from('walk_sessions').insert(entry).select().single();
      savedEntry = data ?? entry;
    }

    setSaving(false);
    setWalkResult({
      isComplete,
      xpEarned,
      distanceM: distanceRef.current,
      elapsedS: elapsedRef.current,
      remainingM: forceComplete ? 0 : remainingM,
      savedEntry,
    });
    setWalkDone(true);
    finalizingRef.current = false;
  };

  const progress = computeWalkProgress(walkObjective, elapsedS, achieved, remainingM);

  if (walkDone && walkResult) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 }]}>
        <Text style={{ fontSize: 64, marginBottom: 16 }}>{walkResult.isComplete ? '🏆' : '🚶'}</Text>
        <Text style={[s.doneTitle, { marginBottom: 8 }]}>{walkResult.isComplete ? 'Objective Complete!' : 'Walk Ended'}</Text>
        <Text style={s.doneSubtitle}>
          {formatDistance(walkResult.distanceM)} walked | {formatElapsedTime(walkResult.elapsedS)}
          {walkResult.xpEarned > 0 ? `\n+${walkResult.xpEarned} XP earned!` : ''}
        </Text>
        <TouchableOpacity style={[s.doneBtn, { marginTop: 24 }]} onPress={() => { setWalkDone(false); setCoords([]); onWalkComplete(walkResult); }} activeOpacity={0.85}>
          <Text style={s.doneBtnText}>Return Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const openGoogleMaps = () => {
    if (destinationRef.current && currentLocation) {
      const url = buildGoogleMapsDirectionsUrl(currentLocation, destinationRef.current);
      Linking.openURL(url);
    } else if (currentLocation) {
      const url = buildGoogleMapsViewerUrl(currentLocation);
      Linking.openURL(url);
    }
  };

  return (
    <ScrollView style={s.scrollRoot} contentContainerStyle={[s.scrollContent, { paddingTop: 30 }]}>
      {/* Header */}
      <Text style={s.appTitle}>Walk Quest</Text>
      <Text style={[s.appSubtitle, { marginBottom: 20 }]}>GPS tracked | XP rewarded</Text>

      {/* Objective card */}
      <View style={s.walkObjCardFull}>
        <Text style={s.walkObjTitle}>🗺️ TODAY'S WALK</Text>
        {walkLoading
          ? <ActivityIndicator size="small" color="#FFD700" />
          : <Text style={s.walkObjText}>{walkObjective?.text ?? 'Loading objective...'}</Text>
        }
        <View style={[s.progressTrack, { marginTop: 12 }]}>
          <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={{ color: '#666', fontSize: 11, marginTop: 6, textAlign: 'right' }}>
          {Math.round(progress * 100)}% complete
        </Text>
      </View>

      {/* Achievement banner */}
      {achieved && (
        <View style={{ backgroundColor: '#FFD700', padding: 16, alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 32 }}>🏆</Text>
          <Text style={{ color: '#0A0A0A', fontWeight: '800', fontSize: 16, letterSpacing: 1, marginTop: 4 }}>DESTINATION REACHED!</Text>
          <Text style={{ color: '#0A0A0A', fontSize: 12, marginTop: 2 }}>The quest completes when you reach the destination</Text>
        </View>
      )}

      {/* Stats */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <View style={[s.statCard, { flex: 1, padding: 20 }]}>
          <Text style={[s.walkHUDValue, { fontSize: 28 }]}>{formatDistance(distanceM)}</Text>
          <Text style={s.walkHUDLabel}>Distance</Text>
        </View>
        <View style={[s.statCard, { flex: 1, padding: 20 }]}>
          <Text style={[s.walkHUDValue, { fontSize: 28 }]}>{formatElapsedTime(elapsedS)}</Text>
          <Text style={s.walkHUDLabel}>Time</Text>
        </View>
      </View>

      {/* Google Maps button */}
      {tracking && (
        <TouchableOpacity
          style={[s.primaryBtn, { backgroundColor: '#1A73E8', borderColor: '#1557B0', marginBottom: 12 }]}
          onPress={openGoogleMaps}
          activeOpacity={0.85}
        >
          <Text style={[s.primaryBtnText, { color: '#FFFFFF' }]}>OPEN GOOGLE MAPS</Text>
        </TouchableOpacity>
      )}

      {/* GPS status */}
      {tracking && (
        <View style={{ backgroundColor: '#111', borderWidth: 1, borderColor: '#2A2A2A', padding: 14, marginBottom: 16, alignItems: 'center' }}>
          <Text style={{ color: '#FFD700', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>📡 GPS TRACKING ACTIVE</Text>
          <Text style={{ color: '#666', fontSize: 11, marginTop: 4 }}>Your location is being tracked in the background</Text>
        </View>
      )}

      {/* Start / Stop button */}
      <TouchableOpacity
        style={[s.walkBtn, tracking && s.walkBtnStop, (walkLoading || saving) && { opacity: 0.5 }]}
        onPress={tracking ? () => stopWalk(false) : startWalk}
        disabled={walkLoading || saving}
        activeOpacity={0.85}
      >
        {saving
          ? <ActivityIndicator size="small" color="#0A0A0A" />
          : <Text style={s.walkBtnText}>{tracking ? 'STOP WALK' : 'START WALK'}</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

// ══════════════════════════════════════════
//  WEAPON BADGE (current weapon display)
// ══════════════════════════════════════════
function WeaponBadge({ level = 1, equippedWeaponId, onPress }) {
  // Compact progression indicator that shows the best unlocked or equipped weapon.
  const highestUnlocked = [...WEAPONS].reverse().find(w => level >= w.unlockLevel) || WEAPONS[0];
  const equipped = WEAPONS.find(w => w.id === equippedWeaponId && level >= w.unlockLevel) || highestUnlocked;
  const next = WEAPONS.find(w => w.unlockLevel > level);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[s.weaponBadgeBox, { borderColor: equipped.rarityColor }]}>
      <Text style={[s.weaponBadgeRarity, { color: equipped.rarityColor }]}>{equipped.rarity}</Text>
      <Image source={equipped.image} style={s.weaponBadgeImage} resizeMode="contain" />
      <Text style={s.weaponBadgeName}>{equipped.name}</Text>
      {next && (
        <Text style={s.weaponBadgeNext}>Next: {next.name} at Lv {next.unlockLevel}</Text>
      )}
    </TouchableOpacity>
  );
}

// ══════════════════════════════════════════
//  WEAPON BADGES MODAL (gallery)
// ══════════════════════════════════════════
function WeaponBadgesModal({ visible, onClose, userProfile, onEquip }) {
  // Full weapon progression gallery that doubles as the cosmetic equip screen.
  const level = userProfile ? Math.floor(userProfile.xp / 200) + 1 : 1;
  const equippedId = userProfile?.equipped_cosmetics?.weapon;
  const highestUnlocked = [...WEAPONS].reverse().find(w => level >= w.unlockLevel) || WEAPONS[0];
  const currentId = (WEAPONS.find(w => w.id === equippedId && level >= w.unlockLevel) || highestUnlocked).id;
  const unlockedWeapons = WEAPONS.filter(w => level >= w.unlockLevel);
  const lockedWeapons = WEAPONS.filter(w => level < w.unlockLevel);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={[s.modalCard, s.weaponModalCard, { maxHeight: '85%' }]}>
          <Text style={s.modalTitle}>WEAPON BADGES</Text>
          <Text style={{ color: '#888', fontSize: 12, textAlign: 'center', marginBottom: 16 }}>Tap an unlocked weapon to equip it</Text>
          <ScrollView
            style={s.weaponModalScroll}
            contentContainerStyle={s.weaponModalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.weaponSectionLabel}>Unlocked</Text>
            <View style={s.weaponGrid}>
              {unlockedWeapons.map(w => {
                const isEquipped = w.id === currentId;
                return (
                  <TouchableOpacity
                    key={w.id}
                    onPress={() => onEquip(w.id)}
                    activeOpacity={0.7}
                    style={[s.weaponTile, isEquipped && { borderColor: w.rarityColor, borderWidth: 2 }]}
                  >
                    <Text style={[s.weaponTileRarity, { color: w.rarityColor }]}>{w.rarity}</Text>
                    <Image source={w.image} style={s.weaponTileImage} resizeMode="contain" />
                    <Text style={s.weaponTileName}>{w.name}</Text>
                    <Text style={s.weaponTileLevel}>Lv {w.unlockLevel}</Text>
                    {isEquipped && <Text style={s.weaponTileEquipped}>EQUIPPED</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.weaponSectionLabel}>Locked</Text>
            <View style={s.weaponGrid}>
              {lockedWeapons.map(w => (
                <View key={w.id} style={[s.weaponTile, s.weaponTileLocked]}>
                  <Text style={s.weaponTileRarityLocked}>{w.rarity}</Text>
                  <Image source={w.image} style={s.weaponTileImage} resizeMode="contain" />
                  <Text style={s.weaponTileNameLocked}>{w.name}</Text>
                  <Text style={s.weaponTileLevel}>Unlock at Lv {w.unlockLevel}</Text>
                  <Text style={s.weaponTileLock}>LOCKED</Text>
                </View>
              ))}
            </View>
          </ScrollView>
          <TouchableOpacity style={s.modalCloseBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={s.modalCloseBtnText}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ══════════════════════════════════════════
//  LEVEL UP MODAL
// ══════════════════════════════════════════
function LevelUpModal({ visible, newLevel, unlocks, onClaim }) {
  // Reward modal shown when the user's XP crosses a level boundary.
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClaim}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 8 }}>⚡</Text>
          <Text style={[s.modalTitle, { fontSize: 22 }]}>LEVEL UP!</Text>
          <Text style={[s.modalTitle, { fontSize: 30, color: '#FFD700', marginBottom: 16 }]}>Level {newLevel}</Text>
          {unlocks.length > 0 && (
            <>
              <Text style={{ color: '#AAA', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>New weapon unlocked:</Text>
              {unlocks.map(w => (
                <View key={w.id} style={[s.cosmeticItem, { borderColor: w.rarityColor }]}>
                  <Text style={s.cosmeticItemEmoji}>{w.emoji}</Text>
                  <View>
                    <Text style={[s.cosmeticItemName, { color: w.rarityColor }]}>{w.name}</Text>
                    <Text style={{ color: '#888', fontSize: 11 }}>{w.rarity}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
          <TouchableOpacity style={[s.modalCloseBtn, { marginTop: 20 }]} onPress={onClaim} activeOpacity={0.8}>
            <Text style={s.modalCloseBtnText}>CLAIM</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ══════════════════════════════════════════
//  PROFILE SCREEN
// ══════════════════════════════════════════
function ProfileScreen({ userProfile, sessionHistory, walkHistory, onSignOut, onUpdateProfile, onOpenCosmetics }) {
  // Account/profile hub combining editable personal info with XP, streak,
  // session totals, and access to cosmetic progression.
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(userProfile?.display_name || '');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editAge, setEditAge] = useState(String(userProfile?.age || ''));
  const [editWeight, setEditWeight] = useState(String(userProfile?.weight || ''));
  const [editHeight, setEditHeight] = useState(String(userProfile?.height || ''));
  const [editFitness, setEditFitness] = useState(userProfile?.fitness_level || 'beginner');
  const [saving, setSaving] = useState(false);

  if (!userProfile) return null;

  const level = Math.floor(userProfile.xp / 200) + 1;
  const xpIntoLevel = userProfile.xp % 200;
  const xpProgress = xpIntoLevel / 200;
  const totalSessions = sessionHistory.length + (walkHistory?.length ?? 0);
  const completedSessions = sessionHistory.filter(s => s.completed).length + (walkHistory?.filter(w => w.completed).length ?? 0);
  const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  const saveName = () => {
    if (nameInput.trim() && nameInput.trim() !== userProfile.display_name) {
      onUpdateProfile({ display_name: nameInput.trim() });
    }
    setEditingName(false);
  };

  const saveProfile = async () => {
    setSaving(true);
    await onUpdateProfile({
      age: parseInt(editAge) || userProfile.age,
      weight: parseFloat(editWeight) || userProfile.weight,
      height: parseFloat(editHeight) || userProfile.height,
      fitness_level: editFitness,
    });
    setSaving(false);
    setShowEditModal(false);
  };


  return (
    <ScrollView style={s.scrollRoot} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={s.screenTitle}>PROFILE</Text>

      {/* Weapon badge */}
      <View style={s.profileCharBox}>
        <Text style={s.profileCharTitle}>CURRENT WEAPON</Text>
        <WeaponBadge level={Math.floor(userProfile.xp / 200) + 1} equippedWeaponId={userProfile?.equipped_cosmetics?.weapon} onPress={onOpenCosmetics} />
        <TouchableOpacity style={s.customiseBtn} onPress={onOpenCosmetics} activeOpacity={0.8}>
          <Text style={s.customiseBtnText}>VIEW ALL WEAPONS</Text>
        </TouchableOpacity>
      </View>

      {/* Name */}
      <View style={s.profileCard}>
        {editingName ? (
          <TextInput
            style={s.profileNameInput}
            value={nameInput}
            onChangeText={setNameInput}
            onBlur={saveName}
            onSubmitEditing={saveName}
            autoFocus
            placeholderTextColor="#555"
          />
        ) : (
          <TouchableOpacity onPress={() => setEditingName(true)} activeOpacity={0.7}>
            <Text style={s.profileName}>{userProfile.display_name}</Text>
            <Text style={{ color: '#555', fontSize: 11, textAlign: 'center' }}>Tap to edit name</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Level & XP */}
      <View style={s.profileCard}>
        <View style={s.profileStatRow}>
          <Text style={s.profileStatLabel}>LEVEL</Text>
          <Text style={s.profileStatValue}>{level}</Text>
        </View>
        <View style={s.xpBarOuter}>
          <View style={[s.xpBarFill, { width: `${Math.round(xpProgress * 100)}%` }]} />
        </View>
        <Text style={s.xpBarLabel}>{xpIntoLevel} / 200 XP to next level</Text>
        <View style={[s.profileStatRow, { marginTop: 12 }]}>
          <Text style={s.profileStatLabel}>TOTAL XP</Text>
          <Text style={s.profileStatValue}>{userProfile.xp}</Text>
        </View>
      </View>

      {/* Streaks */}
      <View style={s.profileCard}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={[s.streakBadge, { flex: 1 }]}>
            <Text style={s.streakBadgeNum}>{userProfile.streak}</Text>
            <Text style={s.streakBadgeLabel}>Day Streak</Text>
          </View>
          <View style={[s.streakBadge, { flex: 1, borderColor: '#B8860B' }]}>
            <Text style={[s.streakBadgeNum, { color: '#B8860B' }]}>{userProfile.best_streak}</Text>
            <Text style={s.streakBadgeLabel}>Best Streak</Text>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={s.profileCard}>
        <Text style={s.profileSectionTitle}>STATS</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[
            { label: 'Age', value: `${userProfile.age} yrs` },
            { label: 'Weight', value: `${userProfile.weight} kg` },
            { label: 'Height', value: `${userProfile.height} cm` },
          ].map(stat => (
            <View key={stat.label} style={s.statPill}>
              <Text style={s.statPillLabel}>{stat.label}</Text>
              <Text style={s.statPillValue}>{stat.value}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={[s.customiseBtn, { marginTop: 12 }]} onPress={() => setShowEditModal(true)} activeOpacity={0.8}>
          <Text style={s.customiseBtnText}>EDIT PROFILE</Text>
        </TouchableOpacity>
      </View>

      {/* Session stats */}
      <View style={s.profileCard}>
        <Text style={s.profileSectionTitle}>SESSIONS</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={[s.streakBadge, { flex: 1 }]}>
            <Text style={s.streakBadgeNum}>{totalSessions}</Text>
            <Text style={s.streakBadgeLabel}>Total</Text>
          </View>
          <View style={[s.streakBadge, { flex: 1 }]}>
            <Text style={s.streakBadgeNum}>{completionRate}%</Text>
            <Text style={s.streakBadgeLabel}>Completion</Text>
          </View>
        </View>
      </View>

      {/* Sign out */}
      <TouchableOpacity style={s.signOutBtn} onPress={onSignOut} activeOpacity={0.8}>
        <Text style={s.signOutBtnText}>SIGN OUT</Text>
      </TouchableOpacity>

      {/* Edit profile modal */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>EDIT PROFILE</Text>
            {[
              { label: 'AGE', value: editAge, set: setEditAge, keyboardType: 'numeric' },
              { label: 'WEIGHT (kg)', value: editWeight, set: setEditWeight, keyboardType: 'decimal-pad' },
              { label: 'HEIGHT (cm)', value: editHeight, set: setEditHeight, keyboardType: 'decimal-pad' },
            ].map(field => (
              <View key={field.label} style={{ marginBottom: 12 }}>
                <Text style={s.inputLabel}>{field.label}</Text>
                <TextInput
                  style={s.input}
                  value={field.value}
                  onChangeText={field.set}
                  keyboardType={field.keyboardType}
                  placeholderTextColor="#555"
                />
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 16, alignItems: 'center', backgroundColor: '#1A1A1A', borderWidth: 2, borderColor: '#FFD700' }}
                onPress={() => setShowEditModal(false)}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#FFD700', fontSize: 14, fontWeight: '800', letterSpacing: 2 }}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 16, alignItems: 'center', backgroundColor: '#FFD700' }}
                onPress={saveProfile}
                activeOpacity={0.8}
                disabled={saving}
              >
                {saving ? <ActivityIndicator size="small" color="#0A0A0A" /> : <Text style={{ color: '#0A0A0A', fontSize: 14, fontWeight: '800', letterSpacing: 2 }}>SAVE</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ══════════════════════════════════════════
//  APP ROOT
// ══════════════════════════════════════════
export default function App() {
  // Root app controller.
  // This is the main state owner for auth, profile, workouts, AI content,
  // navigation, and modal flow across the whole application.

  // Navigation state:
  // decides which main screen is visible in the app right now.
  const [screen, setScreen] = useState('home');
  const [exercises, setExercises] = useState(null);
  const activeTab = screen === 'activity' ? 'activity' : screen === 'oracle' ? 'oracle' : screen === 'map' ? 'map' : screen === 'profile' ? 'profile' : 'home';
  const [showWeaponsModal, setShowWeaponsModal] = useState(false);
  const [levelUpUnlocks, setLevelUpUnlocks] = useState([]);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);

  // Workout state:
  // saved session records plus the AI-generated plan currently shown to the user.
  const [sessionHistory, setSessionHistory] = useState([]);
  const [aiExercise, setAiExercise] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Auth state:
  // who is logged in, whether auth is still loading, and current auth screen errors.
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);

  // Profile and walk state:
  // user profile, onboarding progress, past walk records, and today's walk quest.
  const [userProfile, setUserProfile] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingError, setOnboardingError] = useState('');
  const [walkHistory, setWalkHistory] = useState([]);
  const [walkObjective, setWalkObjective] = useState(null);
  const [walkLoading, setWalkLoading] = useState(false);

  // ── Listen for auth changes + load data on login ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadAllData(session.user.id);
      } else {
        setAuthLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadAllData(session.user.id);
      } else {
        setSessionHistory([]);
        setUserProfile(null);
        setWalkHistory([]);
        setAuthLoading(false);
      }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  const loadAllData = async (userId) => {
    // One place that loads everything the main app needs after login.
    setAuthLoading(true);
    await Promise.all([loadSessions(userId), loadProfile(userId), loadWalks(userId)]);
    setAuthLoading(false);
  };

  const loadSessions = async (userId) => {
    // Pulls workout sessions from Supabase.
    // If the user has no cloud sessions yet, it tries to migrate any old local sessions first.
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (!error && data) {
      if (data.length === 0) {
        try {
          const raw = await AsyncStorage.getItem('sessionHistory');
          if (raw) {
            const local = JSON.parse(raw);
            if (local.length > 0) {
              const toInsert = local.map((s) => ({ user_id: userId, date: s.date, exercise: s.exercise, type: s.type, target: s.target, completed: s.completed }));
              const { data: inserted } = await supabase.from('sessions').insert(toInsert).select();
              if (inserted) { setSessionHistory(inserted); await AsyncStorage.removeItem('sessionHistory'); return; }
            }
          }
        } catch (_) {}
      }
      setSessionHistory(data);
    }
  };

  const loadProfile = async (userId) => {
    // Pulls the user's profile row.
    // If none exists yet, the app sends the user to onboarding.
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setUserProfile(data);
    else setShowOnboarding(true);
  };

  const loadWalks = async (userId) => {
    // Pulls completed and incomplete walk quest records for the progress screen.
    const { data } = await supabase.from('walk_sessions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setWalkHistory(data);
  };

  const saveProfile = async (profileData) => {
    // Creates the initial user profile at the end of onboarding.
    setOnboardingLoading(true);
    setOnboardingError('');
    const { data, error } = await supabase.from('profiles').insert({ id: user.id, ...profileData }).select().single();
    if (error) { setOnboardingError(error.message); setOnboardingLoading(false); return; }
    setUserProfile(data);
    setShowOnboarding(false);
    setOnboardingLoading(false);
  };

  useEffect(() => {
    if (screen === 'home' && !aiExercise) fetchAIExercise();
    if (screen === 'map' && !walkObjective) fetchWalkObjective();
  }, [screen]);

  const fetchAIExercise = async () => {
    // Loads the daily workout plan for the home screen.
    // Recent session outcomes are converted into difficulty hints before the AI call.
    setAiLoading(true);
    const difficultyModifiers = computeExerciseDifficulty(sessionHistory);
    const result = await getAIExercise(sessionHistory, userProfile, difficultyModifiers);
    if (result) setAiExercise(result);
    setAiLoading(false);
  };

  const fetchWalkObjective = async () => {
    // Loads the current AI-generated walking objective when the map screen is opened.
    setWalkLoading(true);
    const result = await getAIWalkObjective(userProfile);
    setWalkObjective(result);
    setWalkLoading(false);
  };

  const startExercise = () => {
    // Starts a workout using the AI plan if available, otherwise the static fallback list.
    const exList = aiExercise || getDailyExercises();
    setExercises(Array.isArray(exList) ? exList : [exList]);
    setScreen('exercise');
  };

  const handleComplete = async (completedList) => {
    // Persists successful exercises, updates XP/streak/profile data,
    // and triggers weapon/level-up rewards when thresholds are crossed.
    if (completedList && completedList.length > 0 && user) {
      const todayStr = new Date().toISOString().split("T")[0];
      let totalXP = 0;
      for (const ex of completedList) {
        const entry = { user_id: user.id, date: todayStr, exercise: ex.name, type: ex.type, target: ex.target, completed: true };
        const { data } = await supabase.from('sessions').insert(entry).select().single();
        if (data) setSessionHistory((prev) => [...prev, data]);
        totalXP += calculateXP(ex);
      }
      if (userProfile) {
        const oldLevel = Math.floor(userProfile.xp / 200) + 1;
        const updates = computeUpdatedProfile(userProfile, totalXP, todayStr);
        const newLevel = Math.floor(updates.xp / 200) + 1;
        // Check for new weapon unlocks
        if (newLevel > oldLevel) {
          const newUnlocks = WEAPONS.filter(w => w.unlockLevel > oldLevel && w.unlockLevel <= newLevel);
          setLevelUpUnlocks(newUnlocks);
          setShowLevelUpModal(true);
        }
        await supabase.from('profiles').update(updates).eq('id', user.id);
        setUserProfile((prev) => ({ ...prev, ...updates }));
      }
    }
    setAiExercise(null);
    setScreen('home');
  };

  const handleFail = async (failedExerciseName, completedBeforeFail = []) => {
    // Persists partial progress plus the failed exercise so analytics and
    // difficulty adjustment can reflect both completions and struggles.
    if (user) {
      const todayStr = new Date().toISOString().split("T")[0];
      // Save all exercises completed before failing
      for (const ex of completedBeforeFail) {
        const entry = { user_id: user.id, date: todayStr, exercise: ex.name, type: ex.type, target: ex.target, completed: true };
        const { data } = await supabase.from('sessions').insert(entry).select().single();
        if (data) setSessionHistory((prev) => [...prev, data]);
      }
      // Save the failed exercise
      if (failedExerciseName) {
        const ex = exercises?.find(e => e.name === failedExerciseName) || exercises?.[0];
        if (ex) {
          const entry = { user_id: user.id, date: todayStr, exercise: ex.name, type: ex.type, target: ex.target, completed: false };
          const { data } = await supabase.from('sessions').insert(entry).select().single();
          if (data) setSessionHistory((prev) => [...prev, data]);
        }
      }
    }
    setAiExercise(null);
    setScreen('failed');
  };

  const handleUpdateProfile = async (updates) => {
    // Saves edited profile fields back to Supabase and refreshes local state.
    const { data } = await supabase.from('profiles').update(updates).eq('id', user.id).select().single();
    if (data) setUserProfile(data);
  };


  const returnHome = () => setScreen('home');

  const handleEquipWeapon = async (weaponId) => {
    // Saves the currently selected cosmetic weapon to the profile.
    const current = userProfile?.equipped_cosmetics || {};
    const updated = { ...current, weapon: weaponId };
    await supabase.from('profiles').update({ equipped_cosmetics: updated }).eq('id', user.id);
    setUserProfile(prev => ({ ...prev, equipped_cosmetics: updated }));
  };

  const handleWalkComplete = (result) => {
    // Runs after WalkScreen finishes and returns a result object.
    // This updates local walk history and applies any earned XP to the profile.
    if (result.savedEntry) {
      setWalkHistory((prev) => [result.savedEntry, ...prev]);
    }
    if (result.xpEarned > 0 && userProfile) {
      const todayStr = new Date().toISOString().split("T")[0];
      const updates = computeUpdatedProfile(userProfile, result.xpEarned, todayStr);
      supabase.from('profiles').update(updates).eq('id', user.id);
      setUserProfile((prev) => ({ ...prev, ...updates }));
    }
    setWalkObjective(null);
    setScreen('home');
  };

  // ── Auth handlers ──
  const handleLogin = async (email, password) => {
    setAuthError('');
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setAuthError(error.message); setAuthLoading(false); }
  };

  const handleSignup = async (email, password) => {
    setAuthError('');
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setAuthError(error.message); setAuthLoading(false); }
    else if (!data.session) { setVerificationSent(true); setAuthLoading(false); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAiExercise(null);
    setWalkObjective(null);
    setScreen('home');
  };

  const resetAuthState = () => { setVerificationSent(false); setAuthMode('login'); setAuthError(''); };

  // ── Loading splash ──
  if (authLoading) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={s.loadingText}>LOADING...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Auth gate ──
  if (!user) {
    return (
      <LoginScreen
        mode={authMode}
        onToggleMode={(newMode) => { setAuthMode(newMode); setAuthError(''); setVerificationSent(false); }}
        onLogin={handleLogin}
        onSignup={handleSignup}
        loading={authLoading}
        error={authError}
        verificationSent={verificationSent}
        onBackToLogin={resetAuthState}
      />
    );
  }

  // ── Onboarding gate ──
  if (showOnboarding) {
    return <OnboardingScreen onComplete={saveProfile} loading={onboardingLoading} error={onboardingError} />;
  }

  if (screen === 'exercise' && exercises && exercises.length > 0) {
    return <ExerciseScreen exercises={exercises} onComplete={handleComplete} onFail={handleFail} />;
  }
  if (screen === 'failed') {
    return <FailedScreen onReturn={returnHome} />;
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      {screen === 'home' && (
        <HomeScreen
          onStart={startExercise}
          aiExercise={aiExercise}
          aiLoading={aiLoading}
          sessionHistory={sessionHistory}
          walkHistory={walkHistory}
          onLogout={handleLogout}
          userProfile={userProfile}
        />
      )}
      {screen === 'activity' && (
        <ProgressScreen sessionHistory={sessionHistory} userProfile={userProfile} walkHistory={walkHistory} />
      )}
      {screen === 'oracle' && <OracleScreen sessionHistory={sessionHistory} userProfile={userProfile} />}
      {screen === 'map' && (
        <WalkScreen walkObjective={walkObjective} walkLoading={walkLoading} onWalkComplete={handleWalkComplete} user={user} userProfile={userProfile} />
      )}
      {screen === 'profile' && (
        <ProfileScreen
          userProfile={userProfile}
          sessionHistory={sessionHistory}
          walkHistory={walkHistory}
          onSignOut={handleLogout}
          onUpdateProfile={handleUpdateProfile}
          onOpenCosmetics={() => setShowWeaponsModal(true)}
        />
      )}

      <View style={s.navBar}>
        <TouchableOpacity style={s.navItem} onPress={() => setScreen('home')} activeOpacity={0.7}>
          <Text style={[s.navIcon, activeTab === 'home' && s.navIconActive]}>🏠</Text>
          <Text style={[s.navLabel, activeTab === 'home' && s.navLabelActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => setScreen('activity')} activeOpacity={0.7}>
          <Text style={[s.navIcon, activeTab === 'activity' && s.navIconActive]}>📊</Text>
          <Text style={[s.navLabel, activeTab === 'activity' && s.navLabelActive]}>Progress</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => setScreen('map')} activeOpacity={0.7}>
          <Text style={[s.navIcon, activeTab === 'map' && s.navIconActive]}>🗺️</Text>
          <Text style={[s.navLabel, activeTab === 'map' && s.navLabelActive]}>Walk</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => setScreen('oracle')} activeOpacity={0.7}>
          <Text style={[s.navIcon, activeTab === 'oracle' && s.navIconActive]}>🔮</Text>
          <Text style={[s.navLabel, activeTab === 'oracle' && s.navLabelActive]}>Oracle</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => setScreen('profile')} activeOpacity={0.7}>
          <Text style={[s.navIcon, activeTab === 'profile' && s.navIconActive]}>👤</Text>
          <Text style={[s.navLabel, activeTab === 'profile' && s.navLabelActive]}>Profile</Text>
        </TouchableOpacity>
      </View>

      <WeaponBadgesModal
        visible={showWeaponsModal}
        onClose={() => setShowWeaponsModal(false)}
        userProfile={userProfile}
        onEquip={handleEquipWeapon}
      />
      <LevelUpModal
        visible={showLevelUpModal}
        newLevel={userProfile ? Math.floor(userProfile.xp / 200) + 1 : 1}
        unlocks={levelUpUnlocks}
        onClaim={() => setShowLevelUpModal(false)}
      />
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════
const s = StyleSheet.create({
  /* ── Global ── */
  root: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  scrollRoot: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#FFD700",
    fontWeight: "700",
    letterSpacing: 2,
  },

  /* ── Auth Screens ── */
  authScroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  authLogoWrap: {
    alignItems: "center",
    marginBottom: 30,
  },
  authLogoCircle: {
    width: 80,
    height: 80,
    borderRadius: 0,
    backgroundColor: "#1A1A1A",
    borderWidth: 2,
    borderColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  authLogoEmoji: {
    fontSize: 36,
  },
  authLogoTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFD700",
    letterSpacing: 4,
  },
  authLogoSub: {
    fontSize: 13,
    color: "#888888",
    marginTop: 4,
    letterSpacing: 1,
  },
  authCard: {
    backgroundColor: "#111111",
    borderRadius: 0,
    padding: 24,
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  authCardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 20,
    textAlign: "center",
    letterSpacing: 2,
  },
  authError: {
    color: "#FF4444",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
    fontWeight: "600",
  },
  verifyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  verifyEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  verifyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFD700",
    letterSpacing: 3,
    marginBottom: 16,
    textAlign: "center",
  },
  verifyBody: {
    fontSize: 14,
    color: "#888888",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  onboardingDesc: {
    fontSize: 13,
    color: "#888888",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFD700",
    marginBottom: 6,
    marginTop: 10,
    letterSpacing: 1.5,
  },
  input: {
    backgroundColor: "#0A0A0A",
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#333333",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0A0A0A",
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#333333",
  },
  inputPassword: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#FFFFFF",
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  eyeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFD700",
    letterSpacing: 1,
  },
  primaryBtn: {
    backgroundColor: "#FFD700",
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
    borderWidth: 2,
    borderColor: "#B8860B",
  },
  primaryBtnText: {
    color: "#0A0A0A",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 2,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#333333",
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: "#666666",
    letterSpacing: 1,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111111",
    borderRadius: 0,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: "#333333",
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFD700",
    marginRight: 10,
  },
  googleBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  authFooter: {
    alignItems: "center",
    marginTop: 24,
  },
  authFooterText: {
    fontSize: 13,
    color: "#666666",
    letterSpacing: 0.5,
  },
  authFooterLink: {
    color: "#FFD700",
    fontWeight: "700",
  },
  authFooterTextSmall: {
    fontSize: 12,
    color: "#555555",
    fontWeight: "700",
    letterSpacing: 1,
  },

  /* ── Header ── */
  header: {
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFD700",
    letterSpacing: 4,
  },
  appSubtitle: {
    fontSize: 13,
    color: "#888888",
    marginTop: 4,
    letterSpacing: 1,
  },
  logoutCircle: {
    width: 40,
    height: 40,
    borderRadius: 0,
    backgroundColor: "#111111",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  logoutCircleText: {
    fontSize: 18,
    color: "#FFD700",
  },

  /* ── Admin Dashboard ── */
  adminCard: {
    backgroundColor: "#111111",
    borderRadius: 0,
    padding: 20,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: "#FFD700",
    alignItems: "center",
  },
  adminCardEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  adminCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFD700",
    marginBottom: 4,
    letterSpacing: 1,
  },
  adminCardDesc: {
    fontSize: 13,
    color: "#888888",
  },
  logoutBtn: {
    backgroundColor: "#FF4444",
    borderRadius: 0,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 2,
    borderColor: "#CC0000",
  },
  logoutBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 2,
  },

  /* ── Daily Session Card ── */
  sessionCard: {
    flexDirection: "row",
    backgroundColor: "#111111",
    borderRadius: 0,
    padding: 18,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#FFD700",
    borderLeftWidth: 6,
    borderLeftColor: "#FFD700",
  },
  sessionLeft: {
    justifyContent: "center",
    marginRight: 16,
  },
  sessionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 0,
    backgroundColor: "#1A1A00",
    borderWidth: 2,
    borderColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
  },
  sessionIcon: {
    fontSize: 28,
  },
  sessionRight: {
    flex: 1,
  },
  sessionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFD700",
    letterSpacing: 2,
    marginBottom: 4,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
    letterSpacing: 1,
  },
  sessionDesc: {
    fontSize: 13,
    color: "#888888",
    marginBottom: 10,
  },
  sessionStartRow: {
    alignSelf: "flex-start",
    backgroundColor: "#FFD700",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 0,
  },
  sessionStartText: {
    color: "#0A0A0A",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },

  /* ── AI Badge ── */
  aiBadge: {
    backgroundColor: "#1A1A00",
    borderRadius: 0,
    borderWidth: 1,
    borderColor: "#B8860B",
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 16,
    alignItems: "center",
  },
  aiBadgeText: {
    fontSize: 11,
    color: "#FFD700",
    fontWeight: "700",
    letterSpacing: 1,
  },

  /* ── Calorie Chart ── */
  chartCard: {
    backgroundColor: "#111111",
    borderRadius: 0,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 2,
    letterSpacing: 1,
  },
  chartHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  chartHeaderText: {
    flex: 1,
    paddingRight: 0,
  },
  chartBodyRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  chartSideBtn: {
    width: 52,
    height: 160,
    borderWidth: 2,
    borderColor: "#FFD700",
    backgroundColor: "#171300",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFD700",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  chartNavBtnDisabled: {
    borderColor: "#555555",
    backgroundColor: "#101010",
    shadowOpacity: 0,
    elevation: 0,
  },
  chartNavText: {
    color: "#FFD700",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 24,
  },
  chartNavTextDisabled: {
    color: "#555555",
  },
  chartSubtitle: {
    fontSize: 11,
    color: "#666666",
    letterSpacing: 1,
  },
  chartArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 160,
    flex: 1,
  },
  chartCol: {
    alignItems: "center",
    flex: 1,
  },
  chartVal: {
    fontSize: 10,
    color: "#FFD700",
    fontWeight: "700",
    marginBottom: 4,
  },
  chartBar: {
    width: 22,
    borderRadius: 0,
    backgroundColor: "#FFD700",
    minHeight: 4,
  },
  chartLabel: {
    fontSize: 11,
    color: "#666666",
    marginTop: 6,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  chartTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#333333",
  },
  chartTotalLabel: {
    fontSize: 13,
    color: "#888888",
  },
  chartTotalValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFD700",
    letterSpacing: 1,
  },

  /* ── Calendar ── */
  calendarCard: {
    backgroundColor: "#111111",
    borderRadius: 0,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  calNavRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  calNavBtn: {
    padding: 8,
  },
  calNavText: {
    fontSize: 16,
    color: "#FFD700",
    fontWeight: "700",
  },
  calMonthTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 2,
  },
  calRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  calDayHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: "#555555",
    letterSpacing: 1,
  },
  calDayCircle: {
    width: 32,
    height: 32,
    borderRadius: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  calDayText: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "800",
  },
  calDayToday: {
    backgroundColor: "#FFD700",
    width: 38,
    height: 38,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  calDayTextToday: {
    color: "#111111",
    fontWeight: "900",
    fontSize: 18,
  },
  calDayCompleted: {
    backgroundColor: "#1A1A00",
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  calDayTextCompleted: {
    color: "#FFD700",
    fontWeight: "900",
    fontSize: 16,
  },
  calLegend: {
    flexDirection: "row",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#333333",
  },
  calLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 20,
  },
  calLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 0,
    marginRight: 6,
  },
  calLegendText: {
    fontSize: 12,
    color: "#888888",
  },

  /* ── Bottom Nav ── */
  navBar: {
    flexDirection: "row",
    backgroundColor: "#0A0A0A",
    borderTopWidth: 2,
    borderTopColor: "#FFD700",
    paddingVertical: 8,
    paddingBottom: Platform.OS === "android" ? 26 : 20,
    marginBottom: Platform.OS === "android" ? 8 : 0,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  navIcon: {
    fontSize: 22,
    opacity: 0.35,
  },
  navIconActive: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#444444",
    marginTop: 2,
    letterSpacing: 1,
  },
  navLabelActive: {
    color: "#FFD700",
  },

  /* ── Oracle Chatbot ── */
  oracleContainer: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  oracleHeader: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "#0A0A0A",
  },
  oracleTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFD700",
    letterSpacing: 4,
  },
  oracleSubtitle: {
    fontSize: 13,
    color: "#888888",
    marginTop: 4,
    letterSpacing: 1,
  },
  oracleMessages: {
    flex: 1,
  },
  oracleMessagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  msgBubble: {
    maxWidth: "82%",
    borderRadius: 0,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
  },
  msgUser: {
    alignSelf: "flex-end",
    backgroundColor: "#FFD700",
    borderColor: "#B8860B",
  },
  msgAssistant: {
    alignSelf: "flex-start",
    backgroundColor: "#111111",
    borderColor: "#FFD700",
  },
  msgSender: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFD700",
    marginBottom: 4,
    letterSpacing: 1.5,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 21,
  },
  msgTextUser: {
    color: "#0A0A0A",
    fontWeight: "700",
  },
  msgTextAssistant: {
    color: "#FFFFFF",
  },
  oracleInputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#111111",
    borderTopWidth: 2,
    borderTopColor: "#FFD700",
  },
  oracleInput: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: "#FFFFFF",
    marginRight: 8,
    borderWidth: 2,
    borderColor: "#333333",
  },
  oracleSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 0,
    backgroundColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
  },
  oracleSendText: {
    color: "#0A0A0A",
    fontSize: 20,
    fontWeight: "800",
  },

  /* ── Exercise Screen ── */
  backBtn: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 0,
    backgroundColor: "#111111",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  backBtnText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFD700",
  },
  exerciseScroll: {
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 60,
  },
  exerciseName: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFD700",
    textAlign: "center",
    marginBottom: 20,
    letterSpacing: 3,
  },
  videoPlaceholder: {
    width: "100%",
    height: 220,
    borderRadius: 0,
    backgroundColor: "#111111",
    borderWidth: 2,
    borderColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  videoIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  videoText: {
    color: "#FFD700",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
  },
  videoSubtext: {
    color: "#666666",
    fontSize: 12,
    marginTop: 4,
  },
  instructionsCard: {
    backgroundColor: "#111111",
    borderRadius: 0,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#333333",
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFD700",
    marginBottom: 10,
    letterSpacing: 1.5,
  },
  instructionsBody: {
    fontSize: 14,
    color: "#AAAAAA",
    lineHeight: 22,
  },
  timerContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  timerLabel: {
    fontSize: 13,
    color: "#888888",
    marginBottom: 6,
    letterSpacing: 1,
    fontWeight: "700",
  },
  timerValue: {
    fontSize: 56,
    fontWeight: "800",
    color: "#FFD700",
    marginBottom: 16,
    letterSpacing: 2,
  },
  timerRemaining: {
    fontSize: 12,
    color: "#666666",
    marginTop: 10,
    letterSpacing: 1,
  },
  progressTrack: {
    width: "100%",
    height: 10,
    borderRadius: 0,
    backgroundColor: "#1A1A1A",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#333333",
  },
  progressFill: {
    height: "100%",
    borderRadius: 0,
    backgroundColor: "#FFD700",
  },
  repContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  repLabel: {
    fontSize: 13,
    color: "#888888",
    marginBottom: 16,
    letterSpacing: 1,
    fontWeight: "700",
  },
  repTouchable: {
    marginBottom: 20,
  },
  repCircle: {
    width: 140,
    height: 140,
    borderRadius: 0,
    backgroundColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#B8860B",
  },
  repCount: {
    fontSize: 48,
    fontWeight: "800",
    color: "#0A0A0A",
  },
  repTotal: {
    fontSize: 16,
    fontWeight: "700",
    color: "rgba(0,0,0,0.6)",
    marginTop: -4,
  },
  repRemaining: {
    fontSize: 12,
    color: "#666666",
    marginTop: 10,
    letterSpacing: 1,
  },
  doneSection: {
    alignItems: "center",
    paddingVertical: 20,
  },
  doneIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 0,
    backgroundColor: "#FFD700",
    borderWidth: 4,
    borderColor: "#B8860B",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  doneIcon: {
    fontSize: 36,
    color: "#0A0A0A",
    fontWeight: "800",
  },
  doneTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFD700",
    marginBottom: 8,
    letterSpacing: 2,
  },
  doneSubtitle: {
    fontSize: 14,
    color: "#888888",
    textAlign: "center",
    marginBottom: 28,
    paddingHorizontal: 20,
    lineHeight: 21,
  },
  doneBtn: {
    backgroundColor: "#FFD700",
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#B8860B",
  },
  doneBtnText: {
    color: "#0A0A0A",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#111111",
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#FFD700",
    padding: 28,
    alignItems: "center",
  },
  modalEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 10,
    letterSpacing: 2,
  },
  modalBody: {
    fontSize: 14,
    color: "#888888",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 24,
  },
  modalBtnDanger: {
    width: "100%",
    backgroundColor: "#FF4444",
    paddingVertical: 14,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#CC0000",
    alignItems: "center",
    marginBottom: 10,
  },
  modalBtnDangerText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
  },
  modalBtnStay: {
    width: "100%",
    backgroundColor: "#1A1A1A",
    paddingVertical: 14,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#FFD700",
    alignItems: "center",
  },
  modalBtnStayText: {
    color: "#FFD700",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
  },
  failContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  failEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  failTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FF4444",
    marginBottom: 12,
    letterSpacing: 2,
  },
  failBody: {
    fontSize: 14,
    color: "#888888",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  failBtn: {
    backgroundColor: "#FFD700",
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#B8860B",
  },
  failBtnText: {
    color: "#0A0A0A",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 2,
  },

  // XP Badge (HomeScreen header)
  xpBadgeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 6,
    marginBottom: 4,
  },
  xpBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#FFD700",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  xpBadgeText: {
    color: "#FFD700",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // Progress screen stat grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: "28%",
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    padding: 14,
    alignItems: "center",
    borderRadius: 0,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFD700",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: "#888888",
    letterSpacing: 0.8,
    textAlign: "center",
    fontWeight: "600",
  },

  // Recent sessions list
  sessionScrollBox: {
    maxHeight: 340,
    marginTop: 8,
  },
  recentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  recentLeft: {
    flex: 1,
  },
  recentRight: {
    alignItems: "flex-end",
  },
  recentExercise: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  recentDate: {
    fontSize: 11,
    color: "#666666",
    letterSpacing: 0.5,
  },
  recentDetails: {
    fontSize: 11,
    color: "#FFD700",
    marginTop: 6,
    fontWeight: "700",
  },
  recentSummary: {
    fontSize: 11,
    color: "#9A9A9A",
    marginTop: 4,
    lineHeight: 16,
  },
  recentBadgeWin: {
    backgroundColor: "#FFD700",
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 3,
  },
  recentBadgeFail: {
    backgroundColor: "#2A2A2A",
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 3,
  },
  recentXp: {
    fontSize: 11,
    color: "#888888",
    fontWeight: "600",
  },

  // WalkScreen
  mapView: {
    flex: 1,
    width: "100%",
  },
  walkObjCard: {
    position: "absolute",
    top: 10,
    left: 12,
    right: 12,
    backgroundColor: "rgba(10,10,10,0.92)",
    borderWidth: 1,
    borderColor: "#FFD700",
    padding: 14,
  },
  walkObjCardFull: {
    backgroundColor: "#111111",
    borderWidth: 2,
    borderColor: "#FFD700",
    padding: 18,
    marginBottom: 16,
  },
  walkObjTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFD700",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  walkObjText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "600",
    marginBottom: 8,
    lineHeight: 20,
  },
  walkHUD: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(10,10,10,0.95)",
    borderTopWidth: 2,
    borderTopColor: "#FFD700",
    paddingVertical: 16,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  walkHUDRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 14,
  },
  walkHUDValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFD700",
    textAlign: "center",
  },
  walkHUDLabel: {
    fontSize: 10,
    color: "#888888",
    textAlign: "center",
    letterSpacing: 1,
    fontWeight: "600",
  },
  walkHUDError: {
    fontSize: 12,
    color: "#FF4444",
    textAlign: "center",
    marginBottom: 8,
  },
  walkBtn: {
    backgroundColor: "#FFD700",
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#B8860B",
  },
  walkBtnStop: {
    backgroundColor: "#FF4444",
    borderColor: "#CC0000",
  },
  walkBtnText: {
    color: "#0A0A0A",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 2,
  },

  // Onboarding fitness level selector
  fitnessBtnRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  fitnessBtnBase: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 0,
    borderWidth: 2,
  },
  fitnessBtnActive: {
    backgroundColor: "#FFD700",
    borderColor: "#B8860B",
  },
  fitnessBtnInactive: {
    backgroundColor: "#1A1A1A",
    borderColor: "#2A2A2A",
  },
  fitnessBtnText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  fitnessBtnTextActive: {
    color: "#0A0A0A",
  },
  rankDisplay: {
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    borderRadius: 6,
    padding: 14,
    marginBottom: 20,
    alignItems: "center",
  },
  rankName: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1,
  },
  rankRarity: {
    fontSize: 12,
    letterSpacing: 2,
    marginTop: 2,
    fontWeight: "700",
  },
  rankHint: {
    fontSize: 11,
    color: "#555555",
    marginTop: 6,
  },
  fitnessBtnTextInactive: {
    color: "#888888",
  },

  /* ── Session progress bar (ExerciseScreen) ── */
  sessionProgressBar: {
    height: 4,
    backgroundColor: "#1A1A1A",
    marginHorizontal: 20,
    marginTop: 12,
  },
  sessionProgressFill: {
    height: 4,
    backgroundColor: "#FFD700",
  },
  sessionProgressLabel: {
    color: "#888888",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 2,
  },

  /* ── Rest screen ── */
  restScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  restTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#888888",
    letterSpacing: 4,
    marginBottom: 8,
  },
  restCountdownNum: {
    fontSize: 80,
    fontWeight: "800",
    color: "#FFD700",
    lineHeight: 90,
  },
  restSubtitle: {
    fontSize: 14,
    color: "#888888",
    marginTop: 12,
    marginBottom: 32,
  },
  restSkipBtn: {
    borderWidth: 2,
    borderColor: "#FFD700",
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  restSkipBtnText: {
    color: "#FFD700",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2,
  },

  /* ── Profile screen ── */
  screenTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFD700",
    letterSpacing: 3,
    marginBottom: 20,
  },
  profileCard: {
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    padding: 16,
    marginBottom: 12,
  },
  profileCharBox: {
    backgroundColor: "#111111",
    borderWidth: 2,
    borderColor: "#FFD700",
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
  },
  profileCharTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#888888",
    letterSpacing: 3,
    marginBottom: 12,
  },
  profileSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#888888",
    letterSpacing: 3,
    marginBottom: 12,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFD700",
    textAlign: "center",
    letterSpacing: 1,
    marginBottom: 4,
  },
  profileNameInput: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFD700",
    textAlign: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#FFD700",
    paddingVertical: 4,
    marginBottom: 4,
  },
  profileStatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  profileStatLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#888888",
    letterSpacing: 2,
  },
  profileStatValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFD700",
  },
  xpBarOuter: {
    height: 6,
    backgroundColor: "#1A1A1A",
    marginTop: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  xpBarFill: {
    height: 6,
    backgroundColor: "#FFD700",
  },
  xpBarLabel: {
    fontSize: 11,
    color: "#888888",
    textAlign: "right",
  },
  streakBadge: {
    borderWidth: 2,
    borderColor: "#FFD700",
    padding: 12,
    alignItems: "center",
  },
  streakBadgeNum: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFD700",
  },
  streakBadgeLabel: {
    fontSize: 11,
    color: "#888888",
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 2,
  },
  statPill: {
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    padding: 10,
    minWidth: 80,
    alignItems: "center",
  },
  statPillLabel: {
    fontSize: 10,
    color: "#888888",
    fontWeight: "700",
    letterSpacing: 1,
  },
  statPillValue: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "700",
    marginTop: 2,
    textTransform: "capitalize",
  },
  customiseBtn: {
    borderWidth: 2,
    borderColor: "#FFD700",
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  customiseBtnText: {
    color: "#FFD700",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
  },
  signOutBtn: {
    backgroundColor: "#1A0000",
    borderWidth: 2,
    borderColor: "#FF4444",
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  signOutBtnText: {
    color: "#FF4444",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2,
  },

  /* ── Weapon badge ── */
  weaponBadgeBox: {
    borderWidth: 2,
    alignItems: "center",
    padding: 16,
    marginBottom: 16,
    backgroundColor: "#111111",
  },
  weaponBadgeRarity: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 3,
    marginBottom: 8,
  },
  weaponBadgeImage: {
    width: 100,
    height: 100,
    marginBottom: 10,
  },
  weaponBadgeName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1,
    textAlign: "center",
  },
  weaponBadgeNext: {
    color: "#555555",
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },

  /* ── Weapon badges modal ── */
  weaponModalCard: {
    alignItems: "stretch",
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  weaponModalScroll: {
    width: "100%",
  },
  weaponModalScrollContent: {
    paddingBottom: 8,
  },
  weaponSectionLabel: {
    color: "#FFD700",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 4,
  },
  weaponGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  weaponTile: {
    width: "48%",
    minHeight: 188,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    backgroundColor: "#111111",
    alignItems: "center",
  },
  weaponTileLocked: {
    opacity: 0.45,
  },
  weaponTileImage: {
    width: 72,
    height: 72,
    marginBottom: 10,
  },
  weaponTileRarity: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    textAlign: "center",
    marginBottom: 8,
  },
  weaponTileRarityLocked: {
    color: "#666666",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    textAlign: "center",
    marginBottom: 8,
  },
  weaponTileName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18,
  },
  weaponTileNameLocked: {
    color: "#888888",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18,
  },
  weaponTileLevel: {
    color: "#777777",
    fontSize: 11,
    textAlign: "center",
    marginTop: 6,
  },
  weaponTileEquipped: {
    color: "#FFD700",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 8,
    textAlign: "center",
  },
  weaponTileLock: {
    color: "#B8860B",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 8,
    textAlign: "center",
  },

  /* ── Shared modal item (used in LevelUpModal) ── */
  cosmeticItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    backgroundColor: "#0A0A0A",
    gap: 12,
  },
  cosmeticItemEmoji: {
    fontSize: 22,
  },
  cosmeticItemName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  cosmeticLockText: {
    color: "#888888",
    fontSize: 11,
    marginTop: 2,
  },
  modalCloseBtn: {
    backgroundColor: "#FFD700",
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  modalCloseBtnText: {
    color: "#0A0A0A",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 2,
  },
});
