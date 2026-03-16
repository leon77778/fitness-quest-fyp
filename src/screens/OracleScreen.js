import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { getOracleReply } from "../utils/ai";
import s from "../styles/styles";

export default function OracleScreen({ sessionHistory, userProfile }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Greetings, warrior! I am the Oracle — your guide on this fitness quest. Ask me anything about exercise, nutrition, recovery, or wellbeing. I'm here to help you on your journey!",
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

    try {
      const reply = await getOracleReply(updated, sessionHistory, userProfile);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply || "My vision is clouded... Please try again, warrior.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I cannot reach the realm of knowledge right now. Check your connection and try again.",
        },
      ]);
    }
    setLoading(false);
  };

  return (
    <View style={s.oracleContainer}>
      <View style={s.oracleHeader}>
        <Text style={s.oracleTitle}>The Oracle</Text>
        <Text style={s.oracleSubtitle}>Your AI wellness guide</Text>
      </View>

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
            style={[s.msgBubble, msg.role === "user" ? s.msgUser : s.msgAssistant]}
          >
            {msg.role === "assistant" && <Text style={s.msgSender}>Oracle</Text>}
            <Text
              style={[
                s.msgText,
                msg.role === "user" ? s.msgTextUser : s.msgTextAssistant,
              ]}
            >
              {msg.content}
            </Text>
          </View>
        ))}
        {loading && (
          <View style={[s.msgBubble, s.msgAssistant]}>
            <Text style={s.msgSender}>Oracle</Text>
            <ActivityIndicator
              size="small"
              color="#FFD700"
              style={{ alignSelf: "flex-start" }}
            />
          </View>
        )}
      </ScrollView>

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
