import { useState, useEffect } from "react";
import { SafeAreaView, StatusBar, View, Text, TouchableOpacity } from "react-native";

import HomeScreen from "./src/screens/HomeScreen";
import ActivityScreen from "./src/screens/ActivityScreen";
import OracleScreen from "./src/screens/OracleScreen";
import ExerciseScreen from "./src/screens/ExerciseScreen";
import FailedScreen from "./src/screens/FailedScreen";

import { getDailyExercise } from "./src/constants/exercises";
import { getAIExercise } from "./src/utils/ai";
import { loadSessionHistory, saveSessionHistory } from "./src/utils/storage";
import s from "./src/styles/styles";

export default function App() {
  const [screen, setScreen] = useState("home");
  const [exercise, setExercise] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [aiExercise, setAiExercise] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const activeTab =
    screen === "activity" ? "activity" : screen === "oracle" ? "oracle" : "home";

  // Load persisted session history on startup
  useEffect(() => {
    loadSessionHistory().then(setSessionHistory);
  }, []);

  // Fetch AI exercise whenever we return to home and don't have one
  useEffect(() => {
    if (screen === "home" && !aiExercise) {
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
    setScreen("exercise");
  };

  const recordSession = (completed) => {
    if (!exercise) return;
    const entry = {
      date: new Date().toLocaleDateString(),
      exercise: exercise.name,
      type: exercise.type,
      target: exercise.target,
      completed,
    };
    const updated = [...sessionHistory, entry];
    setSessionHistory(updated);
    saveSessionHistory(updated);
  };

  const handleComplete = () => {
    recordSession(true);
    setAiExercise(null);
    setScreen("home");
  };

  const handleFail = () => {
    recordSession(false);
    setAiExercise(null);
    setScreen("failed");
  };

  const returnHome = () => setScreen("home");

  if (screen === "exercise" && exercise) {
    return (
      <ExerciseScreen
        exercise={exercise}
        onComplete={handleComplete}
        onFail={handleFail}
      />
    );
  }

  if (screen === "failed") {
    return <FailedScreen onReturn={returnHome} />;
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      {screen === "home" && (
        <HomeScreen
          onStart={startExercise}
          aiExercise={aiExercise}
          aiLoading={aiLoading}
          sessionHistory={sessionHistory}
        />
      )}
      {screen === "activity" && (
        <ActivityScreen sessionHistory={sessionHistory} />
      )}
      {screen === "oracle" && (
        <OracleScreen sessionHistory={sessionHistory} userProfile={null} />
      )}

      <View style={s.navBar}>
        <TouchableOpacity
          style={s.navItem}
          onPress={() => setScreen("home")}
          activeOpacity={0.7}
        >
          <Text style={[s.navIcon, activeTab === "home" && s.navIconActive]}>🏠</Text>
          <Text style={[s.navLabel, activeTab === "home" && s.navLabelActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.navItem}
          onPress={() => setScreen("activity")}
          activeOpacity={0.7}
        >
          <Text style={[s.navIcon, activeTab === "activity" && s.navIconActive]}>📊</Text>
          <Text style={[s.navLabel, activeTab === "activity" && s.navLabelActive]}>
            Activity
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.navItem}
          onPress={() => setScreen("oracle")}
          activeOpacity={0.7}
        >
          <Text style={[s.navIcon, activeTab === "oracle" && s.navIconActive]}>🔮</Text>
          <Text style={[s.navLabel, activeTab === "oracle" && s.navLabelActive]}>
            Oracle
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
