import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_HISTORY_KEY = "@rpgfit:sessionHistory";

export async function loadSessionHistory() {
  try {
    const raw = await AsyncStorage.getItem(SESSION_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Failed to load session history:", err);
    return [];
  }
}

export async function saveSessionHistory(history) {
  try {
    await AsyncStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(history));
  } catch (err) {
    console.warn("Failed to save session history:", err);
  }
}
