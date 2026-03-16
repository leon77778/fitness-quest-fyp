import { useState, useEffect, useRef } from "react";
import { View, Text, Animated, Easing } from "react-native";
import s from "../styles/styles";

export default function TimerDisplay({ duration, onFinish }) {
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
