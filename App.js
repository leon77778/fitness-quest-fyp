import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const ARCHETYPES = [
  "Storm Warden",
  "Frost Ranger",
  "Ashen Vanguard",
  "Dawn Seeker",
  "Iron Nomad",
  "Skybound Mystic",
];
const RACES = [
  { id: "elf", label: "Elf", focus: "Cardio" },
  { id: "orc", label: "Orc", focus: "Strength" },
  { id: "warrior", label: "Warrior", focus: "Endurance" },
];
const GOALS = [
  "Fat Loss",
  "Muscle Gain",
  "Endurance",
  "Flexibility",
  "Mental Health",
];
const EQUIPMENT = ["None", "Dumbbells", "Bands", "Kettlebell", "Full Gym"];
const TIME_WINDOWS = ["10-15 min", "20-30 min", "40-60 min"];
const FACTIONS = ["Aether Guard", "Verdant Circle", "Obsidian Tide"];

const DAILY_MISSIONS = [
  {
    id: "m1",
    title: "Defend the City Gates",
    objective: "12-minute interval walk/run",
    difficulty: "Adaptive",
    reward: "+70 XP, +1 Resolve",
  },
  {
    id: "m2",
    title: "Climb the Frozen Peak",
    objective: "3 rounds: 12 squats, 10 push-ups, 30s plank",
    difficulty: "Challenging",
    reward: "+90 XP, +1 Might",
  },
  {
    id: "m3",
    title: "The Quiet Archive",
    objective: "10-minute mobility + breathwork",
    difficulty: "Recovery",
    reward: "+45 XP, +1 Focus",
  },
];

const XP_PER_LEVEL = 200;

function PushUpGuide() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const torsoTranslate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 18],
  });
  const shadowScale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.7],
  });

  return (
    <View style={styles.pushupWrap}>
      <View style={styles.pushupLabelRow}>
        <Text style={styles.pushupTitle}>Form Guide: Push-Up</Text>
        <Text style={styles.pushupHint}>Hands under shoulders - Core tight</Text>
      </View>
      <View style={styles.pushupStage}>
        <Animated.View style={[styles.pushupShadow, { transform: [{ scaleX: shadowScale }] }]} />
        <Animated.View style={[styles.pushupTorso, { transform: [{ translateY: torsoTranslate }] }]}>
          <View style={styles.pushupHead} />
          <View style={styles.pushupBody} />
          <View style={styles.pushupArm} />
          <View style={styles.pushupLegs} />
        </Animated.View>
      </View>
      <View style={styles.pushupTips}>
        <Text style={styles.pushupTipText}>Lower until elbows hit 90 deg</Text>
        <Text style={styles.pushupTipText}>Press back up with control</Text>
      </View>
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState("character");
  const [race, setRace] = useState(RACES[0]);
  const [name, setName] = useState("Aerin");
  const [heroClass, setHeroClass] = useState(ARCHETYPES[0]);
  const [bio, setBio] = useState("Guardian of the Shifting Vale");
  const [goal, setGoal] = useState(GOALS[2]);
  const [equipment, setEquipment] = useState(EQUIPMENT[0]);
  const [timeWindow, setTimeWindow] = useState(TIME_WINDOWS[0]);
  const [faction, setFaction] = useState(FACTIONS[0]);
  const [xp, setXp] = useState(0);
  const [energy, setEnergy] = useState(5);
  const [questProgress, setQuestProgress] = useState(35);
  const [bossHp, setBossHp] = useState(100);
  const [storyFlags, setStoryFlags] = useState({
    intro: true,
    bossUnlocked: false,
    bossDefeated: false,
  });
  const [streak, setStreak] = useState(4);
  const [fatigue, setFatigue] = useState(2);

  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const progressToNext = xp % XP_PER_LEVEL;
  const questPct = Math.min(100, questProgress);
  const xpTarget = XP_PER_LEVEL * level;
  const xpPct = Math.min(100, (progressToNext / XP_PER_LEVEL) * 100);

  const storybeats = useMemo(() => {
    return [
      {
        id: "s1",
        title: "Prologue: The Shifting Vale",
        text: "You wake beneath a violet sky. The Vale calls for champions.",
        unlocked: true,
      },
      {
        id: "s2",
        title: "Act I: Oath of the Waystones",
        text: "Build your streak to awaken the city guardians.",
        unlocked: xp >= 100,
      },
      {
        id: "s3",
        title: "Act II: The Storm Choir",
        text: "Master recovery and consistency to earn the Choir's blessing.",
        unlocked: xp >= 300,
      },
      {
        id: "s4",
        title: "Boss: The Ashen Wyrm",
        text: "The Wyrm awakens when your quests are complete.",
        unlocked: storyFlags.bossUnlocked,
      },
      {
        id: "s5",
        title: "Epilogue: Relic Reforged",
        text: "Your discipline reshapes the realm and your identity.",
        unlocked: storyFlags.bossDefeated,
      },
    ];
  }, [xp, storyFlags]);

  function handleQuestComplete() {
    setXp((prev) => prev + 80);
    setQuestProgress((prev) => Math.min(100, prev + 18));
    setEnergy((prev) => Math.min(5, prev + 1));
    setStreak((prev) => prev + 1);
    setFatigue((prev) => Math.min(5, prev + 1));
  }

  function advanceStory() {
    if (questPct >= 100 && !storyFlags.bossUnlocked) {
      setStoryFlags((prev) => ({ ...prev, bossUnlocked: true }));
    }
  }

  function bossAttack(power) {
    if (!storyFlags.bossUnlocked || storyFlags.bossDefeated || energy <= 0) return;
    setEnergy((prev) => Math.max(0, prev - 1));
    setBossHp((prev) => Math.max(0, prev - power));
  }

  function finalizeBossFight() {
    if (bossHp <= 0) {
      setStoryFlags((prev) => ({ ...prev, bossDefeated: true }));
      setXp((prev) => prev + 150);
    }
  }

  function rest() {
    setEnergy(5);
    setFatigue((prev) => Math.max(0, prev - 2));
  }

  function missDay() {
    setStreak((prev) => Math.max(0, prev - 1));
    setFatigue((prev) => Math.min(5, prev + 1));
  }

  if (screen === "character") {
    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <View style={styles.heroGlow} />
            <Text style={styles.title}>Choose Your Origin</Text>
            <Text style={styles.subtitle}>
              Your race shapes the training path the story recommends.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.cardTitle}>Character Selection</Text>
              <Text style={styles.sectionMeta}>Pick a race to set your focus</Text>
            </View>
            <View style={styles.row}>
              {RACES.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.raceCard, race.id === option.id && styles.raceCardActive]}
                  onPress={() => setRace(option)}
                >
                  <Text style={styles.raceTitle}>{option.label}</Text>
                  <Text style={styles.raceMeta}>Focus: {option.focus}</Text>
                  <Text style={styles.raceBody}>
                    {option.label === "Elf"
                      ? "Agile scouts who thrive on speed and stamina."
                      : option.label === "Orc"
                      ? "Power-focused warriors who build raw strength."
                      : "Unbreakable guardians built for long trials."}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Hero Name"
              placeholderTextColor="#9aa4c7"
              value={name}
              onChangeText={setName}
            />
            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                if (race.focus === "Cardio") setGoal("Endurance");
                if (race.focus === "Strength") setGoal("Muscle Gain");
                if (race.focus === "Endurance") setGoal("Endurance");
                setScreen("main");
              }}
            >
              <Text style={styles.buttonText}>Begin the Story</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <Text style={styles.title}>Fitness Quest</Text>
          <Text style={styles.subtitle}>
            A living saga that adapts to your body, goals, and choices
          </Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroStat}>Level {level}</Text>
            <Text style={styles.heroStat}>Energy {energy}/5</Text>
            <Text style={styles.heroStat}>Streak {streak}d</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Identity & Goals</Text>
            <Text style={styles.sectionMeta}>Define the hero you are becoming</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Hero Name"
            placeholderTextColor="#9aa4c7"
            value={name}
            onChangeText={setName}
          />
          <View style={styles.row}>
            {ARCHETYPES.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.pill, heroClass === option && styles.pillActive]}
                onPress={() => setHeroClass(option)}
              >
                <Text
                  style={heroClass === option ? styles.pillTextActive : styles.pillText}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.input, styles.inputTall]}
            placeholder="Hero backstory"
            placeholderTextColor="#9aa4c7"
            value={bio}
            onChangeText={setBio}
            multiline
          />
          <View style={styles.slimRow}>
            {GOALS.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.pillSmall, goal === option && styles.pillSmallActive]}
                onPress={() => setGoal(option)}
              >
                <Text
                  style={goal === option ? styles.pillTextActive : styles.pillText}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.slimRow}>
            {TIME_WINDOWS.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.pillSmall, timeWindow === option && styles.pillSmallActive]}
                onPress={() => setTimeWindow(option)}
              >
                <Text
                  style={timeWindow === option ? styles.pillTextActive : styles.pillText}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.slimRow}>
            {EQUIPMENT.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.pillSmall, equipment === option && styles.pillSmallActive]}
                onPress={() => setEquipment(option)}
              >
                <Text
                  style={equipment === option ? styles.pillTextActive : styles.pillText}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Live Progress Engine</Text>
            <Text style={styles.sectionMeta}>
              Adaptive difficulty based on consistency and fatigue
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>XP</Text>
            <Text style={styles.statValue}>
              {xp} / {xpTarget}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${xpPct}%` }]} />
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Story Momentum</Text>
            <Text style={styles.statValue}>{questPct}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFillGold, { width: `${questPct}%` }]} />
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Fatigue</Text>
            <Text style={styles.statValue}>{fatigue}/5</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFillCrimson, { width: `${(fatigue / 5) * 100}%` }]} />
          </View>
          <View style={styles.slimRow}>
            <TouchableOpacity style={styles.buttonGhost} onPress={rest}>
              <Text style={styles.buttonGhostText}>Recovery Mission</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.buttonGhost} onPress={missDay}>
              <Text style={styles.buttonGhostText}>Missed Day</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Today's Story Missions</Text>
            <Text style={styles.sectionMeta}>
              Personalized for {goal.toLowerCase()}, {timeWindow}, {equipment.toLowerCase()}
            </Text>
          </View>
          <PushUpGuide />
          {DAILY_MISSIONS.map((mission) => (
            <View key={mission.id} style={styles.questItem}>
              <View style={styles.questHeader}>
                <Text style={styles.questTitle}>{mission.title}</Text>
                <Text style={styles.questXp}>{mission.reward}</Text>
              </View>
              <Text style={styles.questText}>{mission.objective}</Text>
              <Text style={styles.questMeta}>Difficulty: {mission.difficulty}</Text>
              <TouchableOpacity style={styles.button} onPress={handleQuestComplete}>
                <Text style={styles.buttonText}>Complete Mission</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.buttonGhost} onPress={advanceStory}>
            <Text style={styles.buttonGhostText}>Advance Narrative</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Storyboard</Text>
            <Text style={styles.sectionMeta}>Multiple paths based on your choices</Text>
          </View>
          {storybeats.map((beat) => (
            <View key={beat.id} style={styles.storyBeat}>
              <Text style={styles.storyTitle}>{beat.title}</Text>
              <Text style={beat.unlocked ? styles.storyText : styles.storyLocked}>
                {beat.unlocked ? beat.text : "Unlock this chapter by training."}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Boss Fight: The Ashen Wyrm</Text>
            <Text style={styles.sectionMeta}>Spend energy to strike</Text>
          </View>
          {storyFlags.bossUnlocked ? (
            <>
              <Text style={styles.statText}>Boss HP: {bossHp}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFillCrimson, { width: `${bossHp}%` }]} />
              </View>
              <View style={styles.row}>
                <TouchableOpacity style={styles.buttonSmall} onPress={() => bossAttack(15)}>
                  <Text style={styles.buttonText}>Strike</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.buttonSmall} onPress={() => bossAttack(25)}>
                  <Text style={styles.buttonText}>Power Hit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.buttonSmall} onPress={rest}>
                  <Text style={styles.buttonText}>Rest</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.buttonGhost} onPress={finalizeBossFight}>
                <Text style={styles.buttonGhostText}>Claim Victory</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.storyLocked}>
              Complete your quest progress to unlock the boss fight.
            </Text>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Hero Profile</Text>
          <Text style={styles.footerText}>
            {name} - {heroClass}
          </Text>
          <Text style={styles.footerText}>{bio}</Text>
          <Text style={styles.footerText}>
            {faction} - {goal} - {equipment} - {timeWindow}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0b0f1a",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  hero: {
    backgroundColor: "#12182c",
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1f2948",
  },
  heroGlow: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(122, 208, 245, 0.18)",
  },
  heroRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 16,
    flexWrap: "wrap",
  },
  heroStat: {
    color: "#f6e8b1",
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#f6e8b1",
    letterSpacing: 0.6,
    fontFamily: "Georgia",
  },
  subtitle: {
    fontSize: 16,
    color: "#b3bee6",
    marginTop: 6,
  },
  card: {
    backgroundColor: "#12182c",
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1f2948",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  sectionHeader: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f6e8b1",
    letterSpacing: 0.3,
  },
  sectionMeta: {
    color: "#8d98c2",
    marginTop: 4,
  },
  input: {
    backgroundColor: "#0c1122",
    color: "#e8edff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1b2342",
  },
  inputTall: {
    minHeight: 64,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },
  slimRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#0f1426",
    borderWidth: 1,
    borderColor: "#263257",
  },
  pillSmall: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#0f1426",
    borderWidth: 1,
    borderColor: "#263257",
  },
  pillSmallActive: {
    backgroundColor: "#f6e8b1",
  },
  pillActive: {
    backgroundColor: "#f6e8b1",
  },
  pillText: {
    color: "#b3bee6",
  },
  pillTextActive: {
    color: "#1b2342",
    fontWeight: "600",
  },
  statText: {
    color: "#e8edff",
    marginBottom: 8,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  statLabel: {
    color: "#9aa4c7",
    fontWeight: "600",
  },
  statValue: {
    color: "#e8edff",
    fontWeight: "600",
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#0c1122",
    overflow: "hidden",
    marginBottom: 12,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#7ad0f5",
  },
  progressFillGold: {
    height: "100%",
    backgroundColor: "#f6e8b1",
  },
  progressFillCrimson: {
    height: "100%",
    backgroundColor: "#f96c6c",
  },
  questItem: {
    backgroundColor: "#0c1122",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1b2342",
    marginBottom: 12,
  },
  questHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  questTitle: {
    color: "#f6e8b1",
    fontWeight: "600",
  },
  questXp: {
    color: "#7ad0f5",
    fontSize: 12,
    textAlign: "right",
  },
  questText: {
    color: "#b3bee6",
    marginVertical: 6,
  },
  questMeta: {
    color: "#8d98c2",
    fontSize: 12,
  },
  button: {
    backgroundColor: "#7ad0f5",
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonSmall: {
    backgroundColor: "#7ad0f5",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#0b0f1a",
    fontWeight: "600",
  },
  buttonGhost: {
    borderWidth: 1,
    borderColor: "#7ad0f5",
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonGhostText: {
    color: "#7ad0f5",
    fontWeight: "600",
  },
  storyBeat: {
    marginBottom: 12,
  },
  storyTitle: {
    color: "#f6e8b1",
    fontWeight: "600",
  },
  storyText: {
    color: "#e8edff",
  },
  storyLocked: {
    color: "#6d7696",
    fontStyle: "italic",
  },
  footer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  footerTitle: {
    color: "#f6e8b1",
    fontWeight: "700",
    marginBottom: 6,
  },
  footerText: {
    color: "#9aa4c7",
    textAlign: "center",
    marginBottom: 4,
  },
  raceCard: {
    flexBasis: "100%",
    backgroundColor: "#0c1122",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1b2342",
  },
  raceCardActive: {
    borderColor: "#f6e8b1",
    backgroundColor: "#161d33",
  },
  raceTitle: {
    color: "#f6e8b1",
    fontWeight: "700",
    fontSize: 16,
  },
  raceMeta: {
    color: "#7ad0f5",
    marginTop: 4,
    fontSize: 12,
  },
  raceBody: {
    color: "#9aa4c7",
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
  },
  pushupWrap: {
    backgroundColor: "#0c1122",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1b2342",
    marginBottom: 12,
  },
  pushupLabelRow: {
    marginBottom: 10,
  },
  pushupTitle: {
    color: "#f6e8b1",
    fontWeight: "700",
  },
  pushupHint: {
    color: "#8d98c2",
    marginTop: 4,
    fontSize: 12,
  },
  pushupStage: {
    height: 110,
    backgroundColor: "#0f1426",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1f2948",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  pushupShadow: {
    position: "absolute",
    width: 140,
    height: 12,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.35)",
    bottom: 14,
  },
  pushupTorso: {
    alignItems: "center",
  },
  pushupHead: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#f6e8b1",
    marginBottom: 4,
  },
  pushupBody: {
    width: 100,
    height: 14,
    borderRadius: 8,
    backgroundColor: "#7ad0f5",
  },
  pushupArm: {
    width: 70,
    height: 10,
    borderRadius: 6,
    backgroundColor: "#b3bee6",
    marginTop: 6,
  },
  pushupLegs: {
    width: 90,
    height: 10,
    borderRadius: 6,
    backgroundColor: "#4d5c8f",
    marginTop: 6,
  },
  pushupTips: {
    marginTop: 10,
  },
  pushupTipText: {
    color: "#9aa4c7",
    fontSize: 12,
  },
});

