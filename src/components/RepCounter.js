import { useState, useRef } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import s from "../styles/styles";

export default function RepCounter({ target, onFinish }) {
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
