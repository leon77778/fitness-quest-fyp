export const EXERCISES = [
  {
    id: 1,
    name: "Push-Ups",
    type: "reps",
    target: 15,
    instructions:
      "Place your hands shoulder-width apart on the floor. Keep your body in a straight line from head to heels. Lower your chest until it nearly touches the floor, then push back up. Keep your core tight and breathe steadily throughout.",
  },
  {
    id: 2,
    name: "Plank",
    type: "timer",
    target: 60,
    instructions:
      "Start in a forearm plank position with elbows directly under your shoulders. Keep your body in a straight line — don't let your hips sag or pike up. Engage your core and glutes. Breathe normally and hold the position for the full duration.",
  },
  {
    id: 3,
    name: "Squats",
    type: "reps",
    target: 20,
    instructions:
      "Stand with feet shoulder-width apart. Push your hips back and bend your knees as if sitting into a chair. Keep your chest up and knees tracking over your toes. Lower until your thighs are parallel to the floor, then drive back up through your heels.",
  },
  {
    id: 4,
    name: "Wall Sit",
    type: "timer",
    target: 45,
    instructions:
      "Lean your back flat against a wall and slide down until your knees are at a 90-degree angle. Keep your thighs parallel to the floor and your back pressed against the wall. Hold this position — do not rest your hands on your knees.",
  },
];

export function getDailyExercise() {
  const dayIndex = new Date().getDate() % EXERCISES.length;
  return EXERCISES[dayIndex];
}
