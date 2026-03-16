import { View, Text } from "react-native";
import { getWeeklyCalories } from "../utils/calories";
import s from "../styles/styles";

export default function CalorieChart({ title, sessionHistory }) {
  const data = getWeeklyCalories(sessionHistory || []);
  const maxCal = Math.max(...data.map((d) => d.cal), 1);
  const total = data.reduce((sum, d) => sum + d.cal, 0);

  return (
    <View style={s.chartCard}>
      <Text style={s.chartTitle}>{title || "Calories Burned"}</Text>
      <Text style={s.chartSubtitle}>Last 7 days</Text>

      {total === 0 ? (
        <Text style={s.chartEmptyText}>
          Complete workouts to see your calorie data here.
        </Text>
      ) : (
        <View style={s.chartArea}>
          {data.map((item, i) => {
            const barH = (item.cal / maxCal) * 120;
            return (
              <View key={i} style={s.chartCol}>
                {item.cal > 0 && (
                  <Text style={s.chartVal}>{item.cal}</Text>
                )}
                <View style={[s.chartBar, { height: Math.max(barH, 4) }]} />
                <Text style={s.chartLabel}>{item.day}</Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={s.chartTotalRow}>
        <Text style={s.chartTotalLabel}>Total this week</Text>
        <Text style={s.chartTotalValue}>{total} kcal</Text>
      </View>
    </View>
  );
}
