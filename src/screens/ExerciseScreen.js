import { useState, useEffect } from "react";
import {
  SafeAreaView,
  StatusBar,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Modal,
  BackHandler,
} from "react-native";
import TimerDisplay from "../components/TimerDisplay";
import RepCounter from "../components/RepCounter";
import s from "../styles/styles";

export default function ExerciseScreen({ exercise, onComplete, onFail }) {
  // Runs a single exercise from start to finish.
  // It swaps between instructions, active exercise controls, completion state,
  // and an abandonment modal when the user tries to leave early.
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
  const handleExit = () => {
    setShowExitModal(false);
    onFail();
  };
  const handleStay = () => setShowExitModal(false);

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      {!finished && (
        <TouchableOpacity style={s.backBtn} onPress={() => setShowExitModal(true)}>
          <Text style={s.backBtnText}>✕</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        contentContainerStyle={s.exerciseScroll}
        showsVerticalScrollIndicator={false}
      >
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
            <TouchableOpacity
              style={s.doneBtn}
              onPress={onComplete}
              activeOpacity={0.85}
            >
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
              Leaving now means you fail this session. No XP will be awarded. Are you
              sure?
            </Text>
            <TouchableOpacity
              style={s.modalBtnDanger}
              onPress={handleExit}
              activeOpacity={0.85}
            >
              <Text style={s.modalBtnDangerText}>Leave & Fail</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.modalBtnStay}
              onPress={handleStay}
              activeOpacity={0.85}
            >
              <Text style={s.modalBtnStayText}>Keep Going</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
