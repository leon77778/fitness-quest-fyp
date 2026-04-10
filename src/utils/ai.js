import { GROQ_API_KEY, GROQ_URL } from "../config";

export async function getAIExercise(sessionHistory, userProfile) {
  // Builds a single-exercise recommendation from recent history and profile data,
  // then validates the AI response before returning it to the UI layer.
  const historyText =
    sessionHistory.length === 0
      ? "This is the user's first session ever. Start them off easy."
      : sessionHistory
          .map(
            (s, i) =>
              `Session ${i + 1} (${s.date}): ${s.exercise} — ${s.completed ? "Completed" : "Failed"}${
                s.type === "reps" ? `, ${s.target} reps` : `, ${s.target}s hold`
              }`
          )
          .join("\n");

  const profileText = userProfile
    ? `\nUser profile: Weight ${userProfile.weight}kg, Height ${userProfile.height}cm, Age ${userProfile.age} years old.\n`
    : "";

  const prompt = `You are a fitness coach AI for the RPGFit app. Based on the user's exercise history and profile, pick today's exercise and set an appropriate difficulty.
${profileText}
Available exercises: Push-Ups (reps), Plank (timer/seconds), Squats (reps), Wall Sit (timer/seconds).

Rules:
- If the user is new or coming back from failures, go easy (lower reps/duration)
- If the user has been completing sessions consistently, gradually increase difficulty
- Push-Ups: range 5-50 reps. Plank: range 15-120 seconds. Squats: range 5-40 reps. Wall Sit: range 15-90 seconds.
- Vary the exercises — don't repeat the same one too often
- Consider the user's streak and recent performance

User's session history:
${historyText}

Respond ONLY with valid JSON, no extra text. Use this exact format:
{"name":"Exercise Name","type":"reps or timer","target":number,"instructions":"Clear instructions on how to perform the exercise correctly."}`;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.name && parsed.type && parsed.target && parsed.instructions) {
        return parsed;
      }
    }
    return null;
  } catch (err) {
    console.log("AI error:", err);
    return null;
  }
}

export async function getOracleReply(messages, sessionHistory, userProfile) {
  // Builds the system prompt for the Oracle chat by combining the current
  // conversation with recent workouts and profile information.
  const historyContext =
    sessionHistory.length > 0
      ? "\n\nUser's recent exercise history:\n" +
        sessionHistory
          .slice(-10)
          .map(
            (s) =>
              `${s.date}: ${s.exercise} (${
                s.type === "reps" ? s.target + " reps" : s.target + "s"
              }) — ${s.completed ? "Completed" : "Failed"}`
          )
          .join("\n")
      : "\nThe user is new and hasn't completed any sessions yet.";

  const profileContext = userProfile
    ? `\nUser profile: Weight ${userProfile.weight}kg, Height ${userProfile.height}cm, Age ${userProfile.age} years old.`
    : "";

  const systemPrompt = `You are "The Oracle", a wise and encouraging fitness advisor in the RPGFit app — a gamified fitness quest app. Your personality is warm, motivating, and slightly mystical (like a wise RPG mentor).
${profileContext}

Your role:
- Give advice on exercise form, routines, and progression
- Help with nutrition, hydration, sleep, and recovery
- Provide motivation and encouragement
- Answer health and wellbeing questions
- Reference the user's exercise history when relevant to give personalised advice
- Keep responses concise (2-4 sentences usually) unless the user asks for detail
- Use encouraging, quest-themed language occasionally (warrior, quest, journey, etc.) but don't overdo it
- Never give medical diagnoses — suggest seeing a doctor for medical concerns
${historyContext}`;

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.8,
      max_tokens: 500,
    }),
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}
