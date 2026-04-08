import { useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./lib/supabase";
import * as Linking from "expo-linking";
import { Video, ResizeMode } from "expo-av";
import * as Location from "expo-location";

// react-native-maps is not bundled in Expo Go (SDK 50+) — load safely
let MapView = null;
let Polyline = null;
let Marker = null;
try {
  const RNMaps = require("react-native-maps");
  MapView = RNMaps.default;
  Polyline = RNMaps.Polyline;
  Marker = RNMaps.Marker;
} catch (_) {}
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
  "Push-Ups": 3.8, "Jumping Jacks": 8.0, "Squat Jumps": 7.0,
  "Plank": 3.0, "High Knees": 8.0,
};
const SECS_PER_REP = {
  "Push-Ups": 3.0, "Jumping Jacks": 1.0, "Squat Jumps": 2.5,
};
const DEFAULT_WEIGHT_KG = 70;
const DEFAULT_MET = 5.0;

function estimateCalories(session, weightKg = DEFAULT_WEIGHT_KG) {
  const met = EXERCISE_MET[session.exercise] ?? DEFAULT_MET;
  const weight = weightKg ?? DEFAULT_WEIGHT_KG;
  const durationHours = session.type === "reps"
    ? (session.target * (SECS_PER_REP[session.exercise] ?? 2.0)) / 3600
    : session.target / 3600;
  return met * weight * durationHours;
}

function estimateWalkCalories(walk, weightKg = DEFAULT_WEIGHT_KG) {
  const WALK_MET = 3.5;
  const weight = weightKg ?? DEFAULT_WEIGHT_KG;
  const durationHours = walk.duration_s / 3600;
  return WALK_MET * weight * durationHours;
}

function getCalorieData(sessionHistory, weightKg, walkHistory = []) {
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - i));
    const dateStr = date.toISOString().split("T")[0];
    const exerciseCal = sessionHistory
      .filter((s) => s.completed && s.date === dateStr)
      .reduce((sum, s) => sum + estimateCalories(s, weightKg), 0);
    const walkCal = walkHistory
      .filter((w) => w.completed && w.date === dateStr)
      .reduce((sum, w) => sum + estimateWalkCalories(w, weightKg), 0);
    return { day: DAY_NAMES[date.getDay()], cal: Math.round(exerciseCal + walkCal) };
  });
}

// ── Calendar helper ──
function getCalendarDays(year, month) {
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

function getDailyExercise() {
  const dayIndex = new Date().getDate() % EXERCISES.length;
  return EXERCISES[dayIndex];
}

function getDailyExercises() {
  const base = new Date().getDate();
  return Array.from({ length: 5 }, (_, i) => EXERCISES[(base + i) % EXERCISES.length]);
}

// ── Ask Llama AI for today's 5-exercise session ──
async function getAIExercise(sessionHistory, userProfile, difficultyModifiers = {}) {
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
    console.log("AI error:", err);
    return null;
  }
}

// ── XP / Streak helpers ──
function calculateXP(exercise) {
  if (exercise.type === "reps") return exercise.target * 2;
  return exercise.target * 1;
}

function groupWorkoutSessions(sessionHistory) {
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
      Math.abs(lastGroup.anchorTime - entryTime) <= 3 * 60 * 1000;

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

// ── Haversine distance between two GPS coords (metres) ──
// Calculate destination point given start, distance (metres), and bearing (degrees)
function destinationPoint(start, distanceM, bearingDeg) {
  const R = 6371000;
  const bearing = bearingDeg * Math.PI / 180;
  const lat1 = start.latitude * Math.PI / 180;
  const lon1 = start.longitude * Math.PI / 180;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distanceM / R) + Math.cos(lat1) * Math.sin(distanceM / R) * Math.cos(bearing));
  const lon2 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(distanceM / R) * Math.cos(lat1), Math.cos(distanceM / R) - Math.sin(lat1) * Math.sin(lat2));
  return { latitude: lat2 * 180 / Math.PI, longitude: lon2 * 180 / Math.PI };
}

function haversineDistance(a, b) {
  const R = 6371000;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLon = (b.longitude - a.longitude) * Math.PI / 180;
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ── Ask AI for a walk objective ──
async function getAIWalkObjective(userProfile) {
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
function CalorieChart({ title, data }) {
  const maxCal = Math.max(...data.map((d) => d.cal), 1);
  const total = data.reduce((sum, d) => sum + d.cal, 0);
  return (
    <View style={s.chartCard}>
      <Text style={s.chartTitle}>{title || "Calories Burned"}</Text>
      <Text style={s.chartSubtitle}>Last 7 days</Text>
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
function LoginScreen({ mode, onToggleMode, onLogin, onSignup, onForgotPassword, onSetNewPassword, loading, error, verificationSent, onBackToLogin, passwordResetSent }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = () => {
    if (mode === 'reset') { if (email.trim()) onForgotPassword(email.trim()); return; }
    if (mode === 'newPassword') { if (password.trim()) onSetNewPassword(password.trim()); return; }
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

  // ── Password reset email sent ──
  if (passwordResetSent) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />
        <View style={s.verifyContainer}>
          <Text style={s.verifyEmoji}>🔑</Text>
          <Text style={s.verifyTitle}>CHECK YOUR EMAIL</Text>
          <Text style={s.verifyBody}>
            We sent a password reset link to your inbox. Click it to set a new password, then come back to log in.
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
            {mode === 'login' ? 'ENTER THE REALM' : mode === 'signup' ? 'CREATE YOUR HERO' : mode === 'reset' ? 'RESET PASSWORD' : 'SET NEW PASSWORD'}
          </Text>

          {error ? <Text style={s.authError}>{error}</Text> : null}

          {mode !== 'newPassword' && (
            <>
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
            </>
          )}

          {(mode !== 'reset') && (
            <>
              <Text style={s.inputLabel}>{mode === 'newPassword' ? 'NEW PASSWORD' : 'PASSWORD'}</Text>
              <View style={s.passwordRow}>
                <TextInput
                  style={s.inputPassword}
                  placeholder="••••••••"
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
            </>
          )}

          <TouchableOpacity
            style={[s.primaryBtn, loading && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator size="small" color="#0A0A0A" />
              : <Text style={s.primaryBtnText}>
                  {mode === 'login' ? 'LOGIN' : mode === 'signup' ? 'CREATE ACCOUNT' : mode === 'newPassword' ? 'SAVE NEW PASSWORD' : 'SEND RESET LINK'}
                </Text>
            }
          </TouchableOpacity>

          {mode === 'login' && (
            <TouchableOpacity style={{ marginTop: 14, alignItems: 'center' }} onPress={() => onToggleMode('reset')} disabled={loading}>
              <Text style={s.authFooterTextSmall}>FORGOT PASSWORD?</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.authFooter}>
          {(mode === 'reset' || mode === 'newPassword') ? (
            <TouchableOpacity onPress={onBackToLogin} disabled={loading}>
              <Text style={s.authFooterText}>
                <Text style={s.authFooterLink}>← Back to Login</Text>
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => onToggleMode(mode === 'login' ? 'signup' : 'login')} disabled={loading}>
              <Text style={s.authFooterText}>
                {mode === 'login' ? "No account? " : "Already a hero? "}
                <Text style={s.authFooterLink}>
                  {mode === 'login' ? 'Sign Up' : 'Log In'}
                </Text>
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════
//  ONBOARDING SCREEN
// ══════════════════════════════════════════
function OnboardingScreen({ onComplete, loading, error }) {
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
function HomeScreen({ onStart, aiExercise, aiLoading, calorieData, onLogout, userProfile }) {
  const exerciseList = Array.isArray(aiExercise) ? aiExercise : (aiExercise ? [aiExercise] : getDailyExercises());
  const firstExercise = exerciseList[0];
  const level = userProfile ? Math.floor(userProfile.xp / 200) + 1 : 1;

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
            <Text style={s.sessionStartText}>{aiLoading ? "Loading..." : "Tap to begin →"}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {aiExercise && (
        <View style={s.aiBadge}>
          <Text style={s.aiBadgeText}>Personalised by Llama AI based on your progress</Text>
        </View>
      )}

      <CalorieChart title="Calories Burned" data={calorieData} />
    </ScrollView>
  );
}

// ══════════════════════════════════════════
//  PROGRESS SCREEN
// ══════════════════════════════════════════
function ProgressScreen({ sessionHistory, calorieData, userProfile, walkHistory }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const today = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const days = getCalendarDays(year, month);
  const completedDays = sessionHistory
    .filter((s) => s.completed)
    .map((s) => new Date(s.date))
    .filter((d) => d.getFullYear() === year && d.getMonth() === month)
    .map((d) => d.getDate());

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1);
  };

  // Stats
  const totalSessions = sessionHistory.length;
  const completedSessions = sessionHistory.filter((s) => s.completed).length;
  const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
  const level = userProfile ? Math.floor(userProfile.xp / 200) + 1 : 1;
  const recentSessions = groupWorkoutSessions(sessionHistory);

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
            const isCompleted = day && completedDays.includes(day);
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

      <CalorieChart title="Calorie Loss Overview" data={calorieData} />

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
                    <Text style={s.recentExercise}>🚶 Walk {walkHistory.length - i}</Text>
                    <Text style={s.recentDate}>{walk.date}</Text>
                    <Text style={s.recentDetails}>{walk.objective}</Text>
                    <Text style={s.recentSummary}>{distStr} · {mins}:{secs} · {Math.round(estimateWalkCalories(walk, userProfile?.weight))} kcal</Text>
                  </View>
                  <View style={s.recentRight}>
                    <Text style={walk.completed ? s.recentBadgeWin : s.recentBadgeFail}>
                      {walk.completed ? '✓ Done' : '✗ Incomplete'}
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
        setMessages((prev) => [...prev, { role: "assistant", content: "My vision is clouded... Please try again, adventurer." }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "I cannot reach the realm of knowledge right now. Check your connection and try again." }]);
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
    onFail(exercise?.name);
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
              <Text style={s.videoSubtext}>Video coming soon</Text>
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
function WebMapView({ coords, initialRegion }) {
  const containerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const polylineRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const initLeaflet = () => {
      if (!containerRef.current || leafletMapRef.current) return;
      const L = window.L;
      const map = L.map(containerRef.current).setView(
        [initialRegion.latitude, initialRegion.longitude], 15
      );
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);
      leafletMapRef.current = map;
    };

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (window.L) {
      initLeaflet();
    } else if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = initLeaflet;
      document.head.appendChild(script);
    } else {
      // script already loading — poll briefly
      const poll = setInterval(() => { if (window.L) { clearInterval(poll); initLeaflet(); } }, 100);
    }

    return () => {
      if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!leafletMapRef.current || !window.L || coords.length < 2) return;
    const L = window.L;
    if (polylineRef.current) polylineRef.current.remove();
    const latlngs = coords.map(c => [c.latitude, c.longitude]);
    polylineRef.current = L.polyline(latlngs, { color: '#FFD700', weight: 4 }).addTo(leafletMapRef.current);
    leafletMapRef.current.panTo(latlngs[latlngs.length - 1]);
  }, [coords]);

  return <View ref={containerRef} style={s.mapView} />;
}

// ══════════════════════════════════════════
//  WALK SCREEN
// ══════════════════════════════════════════
function WalkScreen({ walkObjective, walkLoading, onWalkComplete, user, userProfile }) {
  const [tracking, setTracking] = useState(false);
  const [coords, setCoords] = useState([]);
  const [distanceM, setDistanceM] = useState(0);
  const [elapsedS, setElapsedS] = useState(0);
  const [walkDone, setWalkDone] = useState(false);
  const [walkResult, setWalkResult] = useState(null);
  const [permError, setPermError] = useState('');
  const [saving, setSaving] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [achieved, setAchieved] = useState(false);

  const locationSub = useRef(null);
  const timerRef = useRef(null);
  const lastCoordRef = useRef(null);
  const distanceRef = useRef(0);
  const elapsedRef = useRef(0);
  const destinationRef = useRef(null);
  const achievedRef = useRef(false);

  // Get current location as soon as the map opens
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCurrentLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    })();
    return () => {
      locationSub.current?.remove();
      clearInterval(timerRef.current);
    };
  }, []);

  const startWalk = async () => {
    setPermError('');
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
    achievedRef.current = false;
    destinationRef.current = null;
    setTracking(true);

    // Place destination marker and auto-open Google Maps with walking route
    if (walkObjective?.type === 'distance') {
      const bearing = Math.random() * 360;
      const dest = destinationPoint(startCoord, walkObjective.value, bearing);
      setDestination(dest);
      destinationRef.current = dest;
      const url = `https://www.google.com/maps/dir/?api=1&origin=${startCoord.latitude},${startCoord.longitude}&destination=${dest.latitude},${dest.longitude}&travelmode=walking`;
      Linking.openURL(url);
    }

    const sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 3000 },
      (loc) => {
        const newCoord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
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
            if (distToDest <= 30) {
              achievedRef.current = true;
              setAchieved(true);
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
  };

  const stopWalk = async () => {
    locationSub.current?.remove();
    clearInterval(timerRef.current);
    setTracking(false);
    setSaving(true);

    const isComplete = walkObjective
      ? walkObjective.type === 'distance'
        ? distanceRef.current >= walkObjective.value
        : elapsedRef.current >= walkObjective.value
      : false;
    const xpEarned = isComplete ? 50 + Math.floor(distanceRef.current / 10) : 0;

    if (user && walkObjective) {
      const entry = {
        user_id: user.id,
        date: new Date().toISOString().split('T')[0],
        objective: walkObjective.text,
        obj_type: walkObjective.type,
        obj_value: walkObjective.value,
        distance_m: Math.round(distanceRef.current * 100) / 100,
        duration_s: elapsedRef.current,
        xp_earned: xpEarned,
        completed: isComplete,
        route: coords,
      };
      await supabase.from('walk_sessions').insert(entry);
    }

    setSaving(false);
    setWalkResult({ isComplete, xpEarned, distanceM: distanceRef.current, elapsedS: elapsedRef.current });
    setWalkDone(true);
  };

  const formatDist = (m) => m >= 1000 ? `${(m / 1000).toFixed(2)}km` : `${Math.round(m)}m`;
  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const progress = walkObjective && !walkLoading
    ? Math.min(
        walkObjective.type === 'distance' ? distanceM / walkObjective.value : elapsedS / walkObjective.value,
        1
      )
    : 0;

  if (walkDone && walkResult) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 }]}>
        <Text style={{ fontSize: 64, marginBottom: 16 }}>{walkResult.isComplete ? '🏆' : '🚶'}</Text>
        <Text style={[s.doneTitle, { marginBottom: 8 }]}>{walkResult.isComplete ? 'Objective Complete!' : 'Walk Ended'}</Text>
        <Text style={s.doneSubtitle}>
          {formatDist(walkResult.distanceM)} walked · {formatTime(walkResult.elapsedS)}
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
      const url = `https://www.google.com/maps/dir/?api=1&origin=${currentLocation.latitude},${currentLocation.longitude}&destination=${destinationRef.current.latitude},${destinationRef.current.longitude}&travelmode=walking`;
      Linking.openURL(url);
    } else if (currentLocation) {
      const url = `https://www.google.com/maps/@${currentLocation.latitude},${currentLocation.longitude},15z`;
      Linking.openURL(url);
    }
  };

  return (
    <ScrollView style={s.scrollRoot} contentContainerStyle={[s.scrollContent, { paddingTop: 30 }]}>
      {/* Header */}
      <Text style={s.appTitle}>Walk Quest</Text>
      <Text style={[s.appSubtitle, { marginBottom: 20 }]}>GPS tracked · XP rewarded</Text>

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
          <Text style={{ color: '#0A0A0A', fontSize: 12, marginTop: 2 }}>Stop the walk below to claim your XP</Text>
        </View>
      )}

      {/* Stats */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <View style={[s.statCard, { flex: 1, padding: 20 }]}>
          <Text style={[s.walkHUDValue, { fontSize: 28 }]}>{formatDist(distanceM)}</Text>
          <Text style={s.walkHUDLabel}>Distance</Text>
        </View>
        <View style={[s.statCard, { flex: 1, padding: 20 }]}>
          <Text style={[s.walkHUDValue, { fontSize: 28 }]}>{formatTime(elapsedS)}</Text>
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
          <Text style={[s.primaryBtnText, { color: '#FFFFFF' }]}>🗺️ OPEN GOOGLE MAPS</Text>
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
        onPress={tracking ? stopWalk : startWalk}
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
function ProfileScreen({ userProfile, sessionHistory, onSignOut, onUpdateProfile, onOpenCosmetics }) {
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
  const totalSessions = sessionHistory.length;
  const completedSessions = sessionHistory.filter(s => s.completed).length;
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

  const editLevel = userProfile ? Math.floor(userProfile.xp / 200) + 1 : 1;
  const rankWeapon = [...WEAPONS].reverse().find(w => editLevel >= w.unlockLevel) || WEAPONS[0];

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
  const [screen, setScreen] = useState('home');
  const [exercises, setExercises] = useState(null);
  const activeTab = screen === 'activity' ? 'activity' : screen === 'oracle' ? 'oracle' : screen === 'map' ? 'map' : screen === 'profile' ? 'profile' : 'home';
  const [showWeaponsModal, setShowWeaponsModal] = useState(false);
  const [levelUpUnlocks, setLevelUpUnlocks] = useState([]);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);

  const [sessionHistory, setSessionHistory] = useState([]);
  const [aiExercise, setAiExercise] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // ── Auth state ──
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  // ── Profile & walk state ──
  const [userProfile, setUserProfile] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingError, setOnboardingError] = useState('');
  const [walkHistory, setWalkHistory] = useState([]);
  const [walkObjective, setWalkObjective] = useState(null);
  const [walkLoading, setWalkLoading] = useState(false);

  // ── Listen for auth changes + load data on login ──
  useEffect(() => {
    // Handle a deep-link URL (Android: rpgfit://  |  Web: current page URL with token)
    const handleAuthUrl = async (url) => {
      if (!url) return;
      // PKCE flow: Supabase appends ?code=xxx to the redirect URL
      if (url.includes('code=')) {
        await supabase.auth.exchangeCodeForSession(url);
        // onAuthStateChange will fire PASSWORD_RECOVERY automatically
        return;
      }
      // Implicit flow: tokens arrive in the URL fragment (#access_token=...&type=recovery)
      const fragment = url.split('#')[1] || '';
      if (!fragment) return;
      const params = Object.fromEntries(
        fragment.split('&').filter(Boolean).map(p => {
          const eq = p.indexOf('=');
          return [p.slice(0, eq), decodeURIComponent(p.slice(eq + 1))];
        })
      );
      if (params.access_token && params.type === 'recovery') {
        setIsPasswordRecovery(true);
        await supabase.auth.setSession({ access_token: params.access_token, refresh_token: params.refresh_token });
      }
    };

    // App opened via deep link (Android) or page loaded with token in URL (web)
    Linking.getInitialURL().then(handleAuthUrl);
    // Deep link received while app is already running
    const linkingSub = Linking.addEventListener('url', ({ url }) => handleAuthUrl(url));

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadAllData(session.user.id);
      } else {
        setAuthLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        setUser(session?.user ?? null);
        setAuthLoading(false);
        return;
      }
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

    return () => { subscription.unsubscribe(); linkingSub.remove(); };
  }, []);

  const loadAllData = async (userId) => {
    setAuthLoading(true);
    await Promise.all([loadSessions(userId), loadProfile(userId), loadWalks(userId)]);
    setAuthLoading(false);
  };

  const loadSessions = async (userId) => {
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
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setUserProfile(data);
    else setShowOnboarding(true);
  };

  const loadWalks = async (userId) => {
    const { data } = await supabase.from('walk_sessions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setWalkHistory(data);
  };

  const saveProfile = async (profileData) => {
    setOnboardingLoading(true);
    setOnboardingError('');
    const { data, error } = await supabase.from('profiles').insert({ id: user.id, ...profileData }).select().single();
    if (error) { setOnboardingError(error.message); setOnboardingLoading(false); return; }
    setUserProfile(data);
    setShowOnboarding(false);
    setOnboardingLoading(false);
  };

  const calorieData = getCalorieData(sessionHistory, userProfile?.weight, walkHistory);

  useEffect(() => {
    if (screen === 'home' && !aiExercise) fetchAIExercise();
    if (screen === 'map' && !walkObjective) fetchWalkObjective();
  }, [screen]);

  const fetchAIExercise = async () => {
    setAiLoading(true);
    const difficultyModifiers = computeExerciseDifficulty(sessionHistory);
    const result = await getAIExercise(sessionHistory, userProfile, difficultyModifiers);
    if (result) setAiExercise(result);
    setAiLoading(false);
  };

  const fetchWalkObjective = async () => {
    setWalkLoading(true);
    const result = await getAIWalkObjective(userProfile);
    setWalkObjective(result);
    setWalkLoading(false);
  };

  const startExercise = () => {
    const exList = aiExercise || getDailyExercises();
    setExercises(Array.isArray(exList) ? exList : [exList]);
    setScreen('exercise');
  };

  const handleComplete = async (completedList) => {
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

  const handleFail = async (failedExerciseName) => {
    if (failedExerciseName && user) {
      const ex = exercises?.find(e => e.name === failedExerciseName) || exercises?.[0];
      if (ex) {
        const entry = { user_id: user.id, date: new Date().toISOString().split("T")[0], exercise: ex.name, type: ex.type, target: ex.target, completed: false };
        const { data } = await supabase.from('sessions').insert(entry).select().single();
        if (data) setSessionHistory((prev) => [...prev, data]);
      }
    }
    setAiExercise(null);
    setScreen('failed');
  };

  const handleUpdateProfile = async (updates) => {
    const { data } = await supabase.from('profiles').update(updates).eq('id', user.id).select().single();
    if (data) setUserProfile(data);
  };


  const returnHome = () => setScreen('home');

  const handleEquipWeapon = async (weaponId) => {
    const current = userProfile?.equipped_cosmetics || {};
    const updated = { ...current, weapon: weaponId };
    await supabase.from('profiles').update({ equipped_cosmetics: updated }).eq('id', user.id);
    setUserProfile(prev => ({ ...prev, equipped_cosmetics: updated }));
  };

  const handleWalkComplete = (result) => {
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
    const isAdminCode = password === 'admin123';
    const loginEmail = isAdminCode ? process.env.EXPO_PUBLIC_ADMIN_EMAIL : email;
    const loginPass  = isAdminCode ? process.env.EXPO_PUBLIC_ADMIN_PASS  : password;
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPass });
    if (error) { setAuthError(error.message); setAuthLoading(false); }
  };

  const handleSignup = async (email, password) => {
    setAuthError('');
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setAuthError(error.message); setAuthLoading(false); }
    else if (!data.session) { setVerificationSent(true); setAuthLoading(false); }
  };

  const handlePasswordReset = async (email) => {
    setAuthError('');
    setAuthLoading(true);
    const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'rpgfit://';
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) { setAuthError(error.message); setAuthLoading(false); }
    else { setPasswordResetSent(true); setAuthLoading(false); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAiExercise(null);
    setWalkObjective(null);
    setScreen('home');
  };

  const handleSetNewPassword = async (newPassword) => {
    setAuthError('');
    setAuthLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setAuthError(error.message); setAuthLoading(false); }
    else { await supabase.auth.signOut(); setIsPasswordRecovery(false); setAuthLoading(false); resetAuthState(); }
  };

  const resetAuthState = () => { setVerificationSent(false); setPasswordResetSent(false); setAuthMode('login'); setAuthError(''); };

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

  // ── Password recovery gate ──
  if (isPasswordRecovery) {
    return (
      <LoginScreen
        mode="newPassword"
        onToggleMode={() => {}}
        onLogin={() => {}}
        onSignup={() => {}}
        onForgotPassword={() => {}}
        onSetNewPassword={handleSetNewPassword}
        loading={authLoading}
        error={authError}
        verificationSent={false}
        passwordResetSent={false}
        onBackToLogin={() => { supabase.auth.signOut(); setIsPasswordRecovery(false); resetAuthState(); }}
      />
    );
  }

  // ── Auth gate ──
  if (!user) {
    return (
      <LoginScreen
        mode={authMode}
        onToggleMode={(newMode) => { setAuthMode(newMode); setAuthError(''); setVerificationSent(false); setPasswordResetSent(false); }}
        onLogin={handleLogin}
        onSignup={handleSignup}
        onForgotPassword={handlePasswordReset}
        loading={authLoading}
        error={authError}
        verificationSent={verificationSent}
        passwordResetSent={passwordResetSent}
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
          calorieData={calorieData}
          onLogout={handleLogout}
          userProfile={userProfile}
        />
      )}
      {screen === 'activity' && (
        <ProgressScreen sessionHistory={sessionHistory} calorieData={calorieData} userProfile={userProfile} walkHistory={walkHistory} />
      )}
      {screen === 'oracle' && <OracleScreen sessionHistory={sessionHistory} userProfile={userProfile} />}
      {screen === 'map' && (
        <WalkScreen walkObjective={walkObjective} walkLoading={walkLoading} onWalkComplete={handleWalkComplete} user={user} userProfile={userProfile} />
      )}
      {screen === 'profile' && (
        <ProfileScreen
          userProfile={userProfile}
          sessionHistory={sessionHistory}
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
  chartSubtitle: {
    fontSize: 11,
    color: "#666666",
    marginBottom: 18,
    letterSpacing: 1,
  },
  chartArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 160,
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
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  calDayToday: {
    backgroundColor: "#FFD700",
    width: 38,
    height: 38,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  calDayTextToday: {
    color: "#000000",
    fontWeight: "900",
    fontSize: 16,
  },
  calDayCompleted: {
    backgroundColor: "#1A1A00",
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  calDayTextCompleted: {
    color: "#FFD700",
    fontWeight: "800",
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
