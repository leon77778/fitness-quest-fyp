import { useState } from "react";
import { ScrollView, View, Text, TouchableOpacity } from "react-native";
import {
  getCalendarDays,
  getCompletedDaysForMonth,
  MONTH_NAMES,
  DAY_HEADERS,
} from "../utils/calendar";
import CalorieChart from "../components/CalorieChart";
import s from "../styles/styles";

export default function ActivityScreen({ sessionHistory }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const today = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const days = getCalendarDays(year, month);
  const completedDays = getCompletedDaysForMonth(sessionHistory, year, month);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  return (
    <ScrollView
      style={s.scrollRoot}
      contentContainerStyle={s.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.header}>
        <Text style={s.appTitle}>Activity</Text>
        <Text style={s.appSubtitle}>Track your progress</Text>
      </View>

      <View style={s.calendarCard}>
        <View style={s.calNavRow}>
          <TouchableOpacity onPress={prevMonth} style={s.calNavBtn}>
            <Text style={s.calNavText}>◀</Text>
          </TouchableOpacity>
          <Text style={s.calMonthTitle}>
            {MONTH_NAMES[month]} {year}
          </Text>
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
            const isCompleted = day && completedDays.has(day);
            return (
              <View key={i} style={s.calCell}>
                {day ? (
                  <View
                    style={[
                      s.calDayCircle,
                      isToday && s.calDayToday,
                      isCompleted && s.calDayCompleted,
                    ]}
                  >
                    <Text
                      style={[
                        s.calDayText,
                        isToday && s.calDayTextToday,
                        isCompleted && !isToday && s.calDayTextCompleted,
                      ]}
                    >
                      {day}
                    </Text>
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
            <View
              style={[
                s.calLegendDot,
                { backgroundColor: "#FFD700", borderWidth: 1, borderColor: "#B8860B" },
              ]}
            />
            <Text style={s.calLegendText}>Completed</Text>
          </View>
        </View>
      </View>

      <CalorieChart title="Calorie Loss Overview" sessionHistory={sessionHistory} />
    </ScrollView>
  );
}
