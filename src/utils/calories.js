const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Estimates calories burned for a single completed session.
 * Rough approximations for bodyweight exercises.
 */
export function estimateCalories(session) {
  if (!session.completed) return 0;
  if (session.type === "reps") {
    return Math.round(session.target * 0.5); // ~0.5 kcal per rep
  }
  return Math.round((session.target / 60) * 5); // ~5 kcal per minute
}

/**
 * Returns an array of { day, cal } for the last 7 days,
 * derived from actual session history.
 */
export function getWeeklyCalories(sessionHistory) {
  // Builds the last-7-days chart dataset from saved completed sessions.
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }

  return days.map((date) => {
    const dateStr = date.toLocaleDateString();
    const cal = sessionHistory
      .filter((s) => s.date === dateStr && s.completed)
      .reduce((sum, s) => sum + estimateCalories(s), 0);
    return { day: DAY_LABELS[date.getDay()], cal };
  });
}
