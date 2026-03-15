import { StyleSheet } from "react-native";

const s = StyleSheet.create({
  /* ── Global ── */
  root: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  scrollRoot: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 24,
  },

  /* ── Header ── */
  header: {
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFD700",
    letterSpacing: 4,
  },
  appSubtitle: {
    fontSize: 13,
    color: "#888888",
    marginTop: 4,
    letterSpacing: 1,
  },

  /* ── Daily Session Card ── */
  sessionCard: {
    flexDirection: "row",
    backgroundColor: "#111111",
    borderRadius: 0,
    padding: 18,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#FFD700",
    borderLeftWidth: 6,
    borderLeftColor: "#FFD700",
  },
  sessionLeft: {
    justifyContent: "center",
    marginRight: 16,
  },
  sessionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 0,
    backgroundColor: "#1A1A00",
    borderWidth: 2,
    borderColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
  },
  sessionIcon: {
    fontSize: 28,
  },
  sessionRight: {
    flex: 1,
  },
  sessionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFD700",
    letterSpacing: 2,
    marginBottom: 4,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
    letterSpacing: 1,
  },
  sessionDesc: {
    fontSize: 13,
    color: "#888888",
    marginBottom: 10,
  },
  sessionStartRow: {
    alignSelf: "flex-start",
    backgroundColor: "#FFD700",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 0,
  },
  sessionStartText: {
    color: "#0A0A0A",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },

  /* ── AI Badge ── */
  aiBadge: {
    backgroundColor: "#1A1A00",
    borderRadius: 0,
    borderWidth: 1,
    borderColor: "#B8860B",
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 16,
    alignItems: "center",
  },
  aiBadgeText: {
    fontSize: 11,
    color: "#FFD700",
    fontWeight: "700",
    letterSpacing: 1,
  },

  /* ── Calorie Chart ── */
  chartCard: {
    backgroundColor: "#111111",
    borderRadius: 0,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 2,
    letterSpacing: 1,
  },
  chartSubtitle: {
    fontSize: 11,
    color: "#666666",
    marginBottom: 18,
    letterSpacing: 1,
  },
  chartArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 160,
  },
  chartCol: {
    alignItems: "center",
    flex: 1,
  },
  chartVal: {
    fontSize: 10,
    color: "#FFD700",
    fontWeight: "700",
    marginBottom: 4,
  },
  chartBar: {
    width: 22,
    borderRadius: 0,
    backgroundColor: "#FFD700",
    minHeight: 4,
  },
  chartLabel: {
    fontSize: 11,
    color: "#666666",
    marginTop: 6,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  chartTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#333333",
  },
  chartTotalLabel: {
    fontSize: 13,
    color: "#888888",
  },
  chartTotalValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFD700",
    letterSpacing: 1,
  },
  chartEmptyText: {
    fontSize: 12,
    color: "#555555",
    textAlign: "center",
    marginTop: 20,
    fontStyle: "italic",
  },

  /* ── Calendar ── */
  calendarCard: {
    backgroundColor: "#111111",
    borderRadius: 0,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  calNavRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  calNavBtn: {
    padding: 8,
  },
  calNavText: {
    fontSize: 16,
    color: "#FFD700",
    fontWeight: "700",
  },
  calMonthTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 2,
  },
  calRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  calDayHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: "#555555",
    letterSpacing: 1,
  },
  calDayCircle: {
    width: 32,
    height: 32,
    borderRadius: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  calDayText: {
    fontSize: 13,
    color: "#AAAAAA",
    fontWeight: "600",
  },
  calDayToday: {
    backgroundColor: "#FFD700",
  },
  calDayTextToday: {
    color: "#0A0A0A",
    fontWeight: "800",
  },
  calDayCompleted: {
    backgroundColor: "#1A1A00",
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  calDayTextCompleted: {
    color: "#FFD700",
    fontWeight: "800",
  },
  calLegend: {
    flexDirection: "row",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#333333",
  },
  calLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 20,
  },
  calLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 0,
    marginRight: 6,
  },
  calLegendText: {
    fontSize: 12,
    color: "#888888",
  },

  /* ── Bottom Nav ── */
  navBar: {
    flexDirection: "row",
    backgroundColor: "#0A0A0A",
    borderTopWidth: 2,
    borderTopColor: "#FFD700",
    paddingVertical: 8,
    paddingBottom: 20,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  navIcon: {
    fontSize: 22,
    opacity: 0.35,
  },
  navIconActive: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#444444",
    marginTop: 2,
    letterSpacing: 1,
  },
  navLabelActive: {
    color: "#FFD700",
  },

  /* ── Oracle Chatbot ── */
  oracleContainer: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  oracleHeader: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "#0A0A0A",
  },
  oracleTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFD700",
    letterSpacing: 4,
  },
  oracleSubtitle: {
    fontSize: 13,
    color: "#888888",
    marginTop: 4,
    letterSpacing: 1,
  },
  oracleMessages: {
    flex: 1,
  },
  oracleMessagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  msgBubble: {
    maxWidth: "82%",
    borderRadius: 0,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
  },
  msgUser: {
    alignSelf: "flex-end",
    backgroundColor: "#FFD700",
    borderColor: "#B8860B",
  },
  msgAssistant: {
    alignSelf: "flex-start",
    backgroundColor: "#111111",
    borderColor: "#FFD700",
  },
  msgSender: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFD700",
    marginBottom: 4,
    letterSpacing: 1.5,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 21,
  },
  msgTextUser: {
    color: "#0A0A0A",
    fontWeight: "700",
  },
  msgTextAssistant: {
    color: "#FFFFFF",
  },
  oracleInputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#111111",
    borderTopWidth: 2,
    borderTopColor: "#FFD700",
  },
  oracleInput: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: "#FFFFFF",
    marginRight: 8,
    borderWidth: 2,
    borderColor: "#333333",
  },
  oracleSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 0,
    backgroundColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
  },
  oracleSendText: {
    color: "#0A0A0A",
    fontSize: 20,
    fontWeight: "800",
  },

  /* ── Exercise Screen ── */
  backBtn: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 0,
    backgroundColor: "#111111",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  backBtnText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFD700",
  },
  exerciseScroll: {
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 60,
  },
  exerciseName: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFD700",
    textAlign: "center",
    marginBottom: 20,
    letterSpacing: 3,
  },
  videoPlaceholder: {
    width: "100%",
    height: 220,
    borderRadius: 0,
    backgroundColor: "#111111",
    borderWidth: 2,
    borderColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  videoIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  videoText: {
    color: "#FFD700",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
  },
  videoSubtext: {
    color: "#666666",
    fontSize: 12,
    marginTop: 4,
  },
  instructionsCard: {
    backgroundColor: "#111111",
    borderRadius: 0,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#333333",
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFD700",
    marginBottom: 10,
    letterSpacing: 1.5,
  },
  instructionsBody: {
    fontSize: 14,
    color: "#AAAAAA",
    lineHeight: 22,
  },

  /* ── Timer ── */
  timerContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  timerLabel: {
    fontSize: 13,
    color: "#888888",
    marginBottom: 6,
    letterSpacing: 1,
    fontWeight: "700",
  },
  timerValue: {
    fontSize: 56,
    fontWeight: "800",
    color: "#FFD700",
    marginBottom: 16,
    letterSpacing: 2,
  },
  timerRemaining: {
    fontSize: 12,
    color: "#666666",
    marginTop: 10,
    letterSpacing: 1,
  },
  progressTrack: {
    width: "100%",
    height: 10,
    borderRadius: 0,
    backgroundColor: "#1A1A1A",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#333333",
  },
  progressFill: {
    height: "100%",
    borderRadius: 0,
    backgroundColor: "#FFD700",
  },

  /* ── Rep Counter ── */
  repContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  repLabel: {
    fontSize: 13,
    color: "#888888",
    marginBottom: 16,
    letterSpacing: 1,
    fontWeight: "700",
  },
  repTouchable: {
    marginBottom: 20,
  },
  repCircle: {
    width: 140,
    height: 140,
    borderRadius: 0,
    backgroundColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#B8860B",
  },
  repCount: {
    fontSize: 48,
    fontWeight: "800",
    color: "#0A0A0A",
  },
  repTotal: {
    fontSize: 16,
    fontWeight: "700",
    color: "rgba(0,0,0,0.6)",
    marginTop: -4,
  },
  repRemaining: {
    fontSize: 12,
    color: "#666666",
    marginTop: 10,
    letterSpacing: 1,
  },

  /* ── Session Complete ── */
  doneSection: {
    alignItems: "center",
    paddingVertical: 20,
  },
  doneIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 0,
    backgroundColor: "#FFD700",
    borderWidth: 4,
    borderColor: "#B8860B",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  doneIcon: {
    fontSize: 36,
    color: "#0A0A0A",
    fontWeight: "800",
  },
  doneTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFD700",
    marginBottom: 8,
    letterSpacing: 2,
  },
  doneSubtitle: {
    fontSize: 14,
    color: "#888888",
    textAlign: "center",
    marginBottom: 28,
    paddingHorizontal: 20,
    lineHeight: 21,
  },
  doneBtn: {
    backgroundColor: "#FFD700",
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#B8860B",
  },
  doneBtnText: {
    color: "#0A0A0A",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
  },

  /* ── Exit Modal ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#111111",
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#FFD700",
    padding: 28,
    alignItems: "center",
  },
  modalEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 10,
    letterSpacing: 2,
  },
  modalBody: {
    fontSize: 14,
    color: "#888888",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 24,
  },
  modalBtnDanger: {
    width: "100%",
    backgroundColor: "#FF4444",
    paddingVertical: 14,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#CC0000",
    alignItems: "center",
    marginBottom: 10,
  },
  modalBtnDangerText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
  },
  modalBtnStay: {
    width: "100%",
    backgroundColor: "#1A1A1A",
    paddingVertical: 14,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#FFD700",
    alignItems: "center",
  },
  modalBtnStayText: {
    color: "#FFD700",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
  },

  /* ── Failed Screen ── */
  failContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  failEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  failTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FF4444",
    marginBottom: 12,
    letterSpacing: 2,
  },
  failBody: {
    fontSize: 14,
    color: "#888888",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  failBtn: {
    backgroundColor: "#FFD700",
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#B8860B",
  },
  failBtnText: {
    color: "#0A0A0A",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 2,
  },
});

export default s;
