import { useState, useEffect, useRef } from "react";
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
} from "react-native";

// ── Groq API (Llama) ──
const GROQ_API_KEY = "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";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// ── Sample exercises (AI will control reps/duration later) ──
const EXERCISES = [
  {
    id: 1,
    name: "Push-Ups",
    type: "reps",
    target: 15,
    instructions:
      "Place your hands shoulder-width apart on the floor. Keep your body in a straight line from head to heels. Lower your chest until it nearly touches the floor, then push back up. Keep your core tight and breathe steadily throughout.",
  },
  {
    id: 2,
    name: "Plank",
    type: "timer",
    target: 60,
    instructions:
      "Start in a forearm plank position with elbows directly under your shoulders. Keep your body in a straight line — don't let your hips sag or pike up. Engage your core and glutes. Breathe normally and hold the position for the full duration.",
  },
  {
    id: 3,
    name: "Squats",
    type: "reps",
    target: 20,
    instructions:
      "Stand with feet shoulder-width apart. Push your hips back and bend your knees as if sitting into a chair. Keep your chest up and knees tracking over your toes. Lower until your thighs are parallel to the floor, then drive back up through your heels.",
  },
  {
    id: 4,
    name: "Wall Sit",
    type: "timer",
    target: 45,
    instructions:
      "Lean your back flat against a wall and slide down until your knees are at a 90-degree angle. Keep your thighs parallel to the floor and your back pressed against the wall. Hold this position — do not rest your hands on your knees.",
  },
];

// ── Sample calorie data (last 7 days) ──
const CALORIE_DATA = [
  { day: "Mon", cal: 180 },
  { day: "Tue", cal: 240 },
  { day: "Wed", cal: 120 },
  { day: "Thu", cal: 310 },
  { day: "Fri", cal: 200 },
  { day: "Sat", cal: 275 },
  { day: "Sun", cal: 150 },
];

const MAX_CAL = Math.max(...CALORIE_DATA.map((d) => d.cal));

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

// ── Ask Llama AI for today's exercise ──
async function getAIExercise(sessionHistory, userProfile) {
  const historyText = sessionHistory.length === 0
    ? "This is the user's first session ever. Start them off easy."
    : sessionHistory.map((s, i) =>
        `Session ${i + 1} (${s.date}): ${s.exercise} — ${s.completed ? "Completed" : "Failed"}${s.type === "reps" ? `, ${s.target} reps` : `, ${s.target}s hold`}`
      ).join("\n");

  const profileText = userProfile
    ? `\nUser profile: Weight ${userProfile.weight}kg, Height ${userProfile.height}cm, Age ${userProfile.age} years old.\n`
    : "";

  const prompt = `You are a fitness coach AI for the RPGFit app. Based on the user's exercise history and profile, pick today's exercise and set an appropriate difficulty.
${profileText}
Available exercises: Push-Ups (reps), Plank (timer/seconds), Squats (reps), Wall Sit (timer/seconds).

Rules:
- If the user is new or coming back from failures, go easy (lower reps/duration)
- If the user has been completing sessions consistently, gradually increase difficulty
- Push-Ups: range 5-50 reps. Plank: range 15-120 seconds. Squats: range 5-40 reps. Wall Sit: range 15-90 seconds.
- Vary the exercises — don't repeat the same one too often
- Consider the user's streak and recent performance

User's session history:
${historyText}

Respond ONLY with valid JSON, no extra text. Use this exact format:
{"name":"Exercise Name","type":"reps or timer","target":number,"instructions":"Clear instructions on how to perform the exercise correctly."}`;

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
        max_tokens: 300,
      }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    // Parse the JSON from the AI response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.name && parsed.type && parsed.target && parsed.instructions) {
        return parsed;
      }
    }
    // Fallback if parsing fails
    return null;
  } catch (err) {
    console.log("AI error:", err);
    return null;
  }
}

// ══════════════════════════════════════════
//  CALORIE BAR CHART (shared component)
// ══════════════════════════════════════════
function CalorieChart({ title }) {
  return (
    <View style={s.chartCard}>
      <Text style={s.chartTitle}>{title || "Calories Burned"}</Text>
      <Text style={s.chartSubtitle}>Last 7 days</Text>
      <View style={s.chartArea}>
        {CALORIE_DATA.map((item, i) => {
          const barH = (item.cal / MAX_CAL) * 120;
          return (
            <View key={i} style={s.chartCol}>
              <Text style={s.chartVal}>{item.cal}</Text>
              <View style={[s.chartBar, { height: barH }]} />
              <Text style={s.chartLabel}>{item.day}</Text>
            </View>
          );
        })}
      </View>
      <View style={s.chartTotalRow}>
        <Text style={s.chartTotalLabel}>Total this week</Text>
        <Text style={s.chartTotalValue}>
          {CALORIE_DATA.reduce((sum, d) => sum + d.cal, 0)} kcal
        </Text>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════
//  HOME SCREEN
// ══════════════════════════════════════════
function HomeScreen({ onStart, aiExercise, aiLoading }) {
  const exercise = aiExercise || getDailyExercise();

  return (
    <ScrollView style={s.scrollRoot} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={s.headerRow}>
        <View>
          <Text style={s.appTitle}>RPGFit</Text>
          <Text style={s.appSubtitle}>Your daily quest awaits</Text>
        </View>
      </View>

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
          <Text style={s.sessionTitle}>Daily Session</Text>
          {aiLoading ? (
            <Text style={s.sessionDesc}>AI is preparing your workout...</Text>
          ) : (
            <Text style={s.sessionDesc}>
              {exercise.name} — {exercise.type === "reps" ? `${exercise.target} reps` : `${exercise.target}s hold`}
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

      <CalorieChart title="Calories Burned" />
    </ScrollView>
  );
}

// ══════════════════════════════════════════
//  ACTIVITY BOARD SCREEN
// ══════════════════════════════════════════
function ActivityScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const today = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const days = getCalendarDays(year, month);
  const completedDays = [3, 5, 8, 12, 14, 17, 19, 21];

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  return (
    <ScrollView style={s.scrollRoot} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={s.header}>
        <Text style={s.appTitle}>Activity</Text>
        <Text style={s.appSubtitle}>Track your progress</Text>
      </View>

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
                  <View style={[
                    s.calDayCircle,
                    isToday && s.calDayToday,
                    isCompleted && s.calDayCompleted,
                  ]}>
                    <Text style={[
                      s.calDayText,
                      isToday && s.calDayTextToday,
                      isCompleted && !isToday && s.calDayTextCompleted,
                    ]}>{day}</Text>
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

      <CalorieChart title="Calorie Loss Overview" />
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
      content: "Greetings, warrior! I am the Oracle — your guide on this fitness quest. Ask me anything about exercise, nutrition, recovery, or wellbeing. I'm here to help you on your journey!",
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
- Use encouraging, quest-themed language occasionally (warrior, quest, journey, etc.) but don't overdo it
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
        setMessages((prev) => [...prev, { role: "assistant", content: "My vision is clouded... Please try again, warrior." }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "I cannot reach the realm of knowledge right now. Check your connection and try again." }]);
    }
    setLoading(false);
  };

  return (
    <View style={s.oracleContainer}>
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
    </View>
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
  const [count, setCount] = useState(0);
  const scale = useRef(new Animated.Value(1)).current;

  const handleTap = () => {
    if (count >= target) return;
    const next = count + 1;
    setCount(next);

    Animated.sequence([
      Animated.timing(scale, { toValue: 1.2, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();

    if (next >= target) {
      setTimeout(onFinish, 400);
    }
  };

  return (
    <View style={s.repContainer}>
      <Text style={s.repLabel}>Tap after each rep</Text>
      <TouchableOpacity onPress={handleTap} activeOpacity={0.7} style={s.repTouchable}>
        <Animated.View style={[s.repCircle, { transform: [{ scale }] }]}>
          <Text style={s.repCount}>{count}</Text>
          <Text style={s.repTotal}>/ {target}</Text>
        </Animated.View>
      </TouchableOpacity>
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${(count / target) * 100}%` }]} />
      </View>
      <Text style={s.repRemaining}>{target - count} reps remaining</Text>
    </View>
  );
}

// ══════════════════════════════════════════
//  EXERCISE SCREEN
// ══════════════════════════════════════════
function ExerciseScreen({ exercise, onComplete, onFail }) {
  const [finished, setFinished] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!finished) {
        setShowExitModal(true);
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [finished]);

  const handleExerciseFinish = () => setFinished(true);
  const handleExit = () => { setShowExitModal(false); onFail(); };
  const handleStay = () => setShowExitModal(false);

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      {!finished && (
        <TouchableOpacity style={s.backBtn} onPress={() => setShowExitModal(true)}>
          <Text style={s.backBtnText}>✕</Text>
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={s.exerciseScroll} showsVerticalScrollIndicator={false}>
        <Text style={s.exerciseName}>{exercise.name}</Text>

        <View style={s.videoPlaceholder}>
          <Text style={s.videoIcon}>🎬</Text>
          <Text style={s.videoText}>Exercise Demo</Text>
          <Text style={s.videoSubtext}>Video coming soon</Text>
        </View>

        <View style={s.instructionsCard}>
          <Text style={s.instructionsTitle}>How to perform</Text>
          <Text style={s.instructionsBody}>{exercise.instructions}</Text>
        </View>

        {!finished && exercise.type === "timer" && (
          <TimerDisplay duration={exercise.target} onFinish={handleExerciseFinish} />
        )}
        {!finished && exercise.type === "reps" && (
          <RepCounter target={exercise.target} onFinish={handleExerciseFinish} />
        )}

        {finished && (
          <View style={s.doneSection}>
            <View style={s.doneIconCircle}>
              <Text style={s.doneIcon}>✓</Text>
            </View>
            <Text style={s.doneTitle}>Session Complete!</Text>
            <Text style={s.doneSubtitle}>
              Great work, warrior. You've conquered today's challenge.
            </Text>
            <TouchableOpacity style={s.doneBtn} onPress={onComplete} activeOpacity={0.85}>
              <Text style={s.doneBtnText}>Claim Rewards & Return</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal visible={showExitModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalEmoji}>⚠️</Text>
            <Text style={s.modalTitle}>Abandon Session?</Text>
            <Text style={s.modalBody}>
              Leaving now means you fail this session. No XP will be awarded. Are you sure?
            </Text>
            <TouchableOpacity style={s.modalBtnDanger} onPress={handleExit} activeOpacity={0.85}>
              <Text style={s.modalBtnDangerText}>Leave & Fail</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalBtnStay} onPress={handleStay} activeOpacity={0.85}>
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
//  APP ROOT
// ══════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState('home');
  const [exercise, setExercise] = useState(null);
  const activeTab = screen === 'activity' ? 'activity' : screen === 'oracle' ? 'oracle' : 'home';

  const [sessionHistory, setSessionHistory] = useState([]);
  const [aiExercise, setAiExercise] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (screen === 'home' && !aiExercise) {
      fetchAIExercise();
    }
  }, [screen]);

  const fetchAIExercise = async () => {
    setAiLoading(true);
    const result = await getAIExercise(sessionHistory, null);
    if (result) setAiExercise(result);
    setAiLoading(false);
  };

  const startExercise = () => {
    setExercise(aiExercise || getDailyExercise());
    setScreen('exercise');
  };

  const handleComplete = () => {
    if (exercise) {
      setSessionHistory((prev) => [
        ...prev,
        { date: new Date().toLocaleDateString(), exercise: exercise.name, type: exercise.type, target: exercise.target, completed: true },
      ]);
    }
    setAiExercise(null);
    setScreen('home');
  };

  const handleFail = () => {
    if (exercise) {
      setSessionHistory((prev) => [
        ...prev,
        { date: new Date().toLocaleDateString(), exercise: exercise.name, type: exercise.type, target: exercise.target, completed: false },
      ]);
    }
    setAiExercise(null);
    setScreen('failed');
  };

  const returnHome = () => setScreen('home');

  if (screen === 'exercise' && exercise) {
    return <ExerciseScreen exercise={exercise} onComplete={handleComplete} onFail={handleFail} />;
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
        />
      )}
      {screen === 'activity' && <ActivityScreen />}
      {screen === 'oracle' && <OracleScreen sessionHistory={sessionHistory} userProfile={null} />}

      <View style={s.navBar}>
        <TouchableOpacity style={s.navItem} onPress={() => setScreen('home')} activeOpacity={0.7}>
          <Text style={[s.navIcon, activeTab === 'home' && s.navIconActive]}>🏠</Text>
          <Text style={[s.navLabel, activeTab === 'home' && s.navLabelActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => setScreen('activity')} activeOpacity={0.7}>
          <Text style={[s.navIcon, activeTab === 'activity' && s.navIconActive]}>📊</Text>
          <Text style={[s.navLabel, activeTab === 'activity' && s.navLabelActive]}>Activity</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => setScreen('oracle')} activeOpacity={0.7}>
          <Text style={[s.navIcon, activeTab === 'oracle' && s.navIconActive]}>🔮</Text>
          <Text style={[s.navLabel, activeTab === 'oracle' && s.navLabelActive]}>Oracle</Text>
        </TouchableOpacity>
      </View>
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
    color: "#AAAAAA",
    fontWeight: "600",
  },
  calDayToday: {
    backgroundColor: "#FFD700",
  },
  calDayTextToday: {
    color: "#0A0A0A",
    fontWeight: "800",
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
    paddingBottom: 20,
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
});
