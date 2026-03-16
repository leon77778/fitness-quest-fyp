import { SafeAreaView, View, Text, TouchableOpacity } from "react-native";
import s from "../styles/styles";

export default function FailedScreen({ onReturn }) {
  return (
    <SafeAreaView style={s.root}>
      <View style={s.failContainer}>
        <Text style={s.failEmoji}>💀</Text>
        <Text style={s.failTitle}>Session Failed</Text>
        <Text style={s.failBody}>
          You left before completing the exercise. No XP earned this time. Come back
          stronger tomorrow!
        </Text>
        <TouchableOpacity style={s.failBtn} onPress={onReturn} activeOpacity={0.85}>
          <Text style={s.failBtnText}>Return Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
