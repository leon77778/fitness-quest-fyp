import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { getDailyExercise } from "../constants/exercises";
import CalorieChart from "../components/CalorieChart";
import s from "../styles/styles";

export default function HomeScreen({ onStart, aiExercise, aiLoading, sessionHistory }) {
  // Main landing screen for the modular UI version.
  // It shows today's quest, AI loading state, and the weekly calorie summary.
  const exercise = aiExercise || getDailyExercise();

  return (
    <ScrollView
      style={s.scrollRoot}
      contentContainerStyle={s.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.headerRow}>
        <View>
          <Text style={s.appTitle}>RPGFit</Text>
          <Text style={s.appSubtitle}>Your daily quest awaits</Text>
        </View>
      </View>

      <TouchableOpacity
        style={s.sessionCard}
        onPress={onStart}
        activeOpacity={0.85}
        disabled={aiLoading}
      >
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
              {exercise.name} —{" "}
              {exercise.type === "reps"
                ? `${exercise.target} reps`
                : `${exercise.target}s hold`}
            </Text>
          )}
          <View style={s.sessionStartRow}>
            <Text style={s.sessionStartText}>
              {aiLoading ? "Loading..." : "Tap to begin →"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {aiExercise && (
        <View style={s.aiBadge}>
          <Text style={s.aiBadgeText}>
            Personalised by Llama AI based on your progress
          </Text>
        </View>
      )}

      <CalorieChart title="Calories Burned" sessionHistory={sessionHistory} />
    </ScrollView>
  );
}
