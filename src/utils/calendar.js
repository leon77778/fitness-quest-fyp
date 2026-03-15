export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

/**
 * Returns a Set of day-of-month numbers that have at least one completed
 * session in the given year/month, derived from sessionHistory.
 */
export function getCompletedDaysForMonth(sessionHistory, year, month) {
  const completedDays = new Set();
  sessionHistory.forEach((session) => {
    if (!session.completed) return;
    const d = new Date(session.date);
    if (isNaN(d.getTime())) return;
    if (d.getFullYear() === year && d.getMonth() === month) {
      completedDays.add(d.getDate());
    }
  });
  return completedDays;
}
