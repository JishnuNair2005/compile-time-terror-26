import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function TeacherDashboard() {
  const [data] = useState({
    gotIt: 60,
    sortOf: 25,
    lost: 15,
  });

  const [questions] = useState([
    { text: "What is a variable?", count: 8, priority: "High" },
    { text: "Repeat example", count: 3, priority: "Normal" },
  ]);

  return (
    <SafeAreaProvider>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <Text style={styles.title}>ClassPulse Dashboard</Text>
        <Text style={styles.sub}>Total: 28 Students</Text>

        {/* 📊 UNDERSTANDING */}
        <View style={styles.card}>
          <ProgressBar label="Got it" value={data.gotIt} color="#22C55E" />
          <ProgressBar label="Sort of" value={data.sortOf} color="#F59E0B" />
          <ProgressBar label="Lost" value={data.lost} color="#EF4444" />
        </View>

        {/* 🤖 AI INSIGHT */}
        <View style={styles.aiCard}>
          <Text style={styles.aiTitle}>AI Suggestion</Text>
          <Text style={styles.aiText}>
            Most students are following. Clarify variable scoping for better
            understanding.
          </Text>
        </View>

        {/* ❓ QUESTIONS */}
        <Text style={styles.sectionTitle}>Question Queue</Text>

        {questions.map((q, i) => (
          <View key={i} style={styles.questionCard}>
            <View style={styles.countBox}>
              <Text style={styles.count}>{q.count}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.qText}>{q.text}</Text>
              <Text style={styles.qSub}>Priority: {q.priority}</Text>
            </View>

            <TouchableOpacity style={styles.answerBtn}>
              <Text style={{ color: "white" }}>Answer</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* 📊 STATS */}
        <View style={styles.statsRow}>
          <Stat label="Class Pace" value="Normal" />
          <Stat label="Polls" value="0" />
          <Stat label="Duration" value="42m" />
        </View>

        {/* 🔴 END SESSION */}
        <TouchableOpacity style={styles.endBtn}>
          <Text style={styles.endText}>End Session</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaProvider>
  );
}

// 🔥 PROGRESS BAR
function ProgressBar({ label, value, color }) {
  return (
    <View style={{ marginBottom: 15 }}>
      <Text style={styles.barLabel}>
        {label} ({value}%)
      </Text>

      <View style={styles.barBg}>
        <View
          style={[
            styles.barFill,
            { width: `${value}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

// 🔥 STAT BOX
function Stat({ label, value }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FB",
    padding: 20,
  },

  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000066",
  },

  sub: {
    color: "#555",
    marginBottom: 20,
  },

  card: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    elevation: 3,
  },

  barLabel: {
    color: "#333",
    marginBottom: 5,
    fontWeight: "600",
  },

  barBg: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 10,
  },

  barFill: {
    height: 8,
    borderRadius: 10,
  },

  aiCard: {
    backgroundColor: "#EEF2FF",
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },

  aiTitle: {
    color: "#4338CA",
    fontWeight: "bold",
  },

  aiText: {
    color: "#333",
    marginTop: 5,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000066",
    marginBottom: 10,
  },

  questionCard: {
    flexDirection: "row",
    backgroundColor: "white",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: "center",
    elevation: 2,
  },

  countBox: {
    width: 40,
    height: 40,
    backgroundColor: "#000066",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginRight: 10,
  },

  count: {
    color: "white",
    fontWeight: "bold",
  },

  qText: {
    color: "#111",
    fontWeight: "bold",
  },

  qSub: {
    color: "#666",
    fontSize: 12,
  },

  answerBtn: {
    backgroundColor: "#22C55E",
    padding: 10,
    borderRadius: 8,
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 20,
  },

  statBox: {
    backgroundColor: "white",
    padding: 12,
    borderRadius: 10,
    width: "30%",
    elevation: 2,
  },

  statLabel: {
    color: "#777",
    fontSize: 10,
  },

  statValue: {
    color: "#000066",
    fontWeight: "bold",
  },

  endBtn: {
    backgroundColor: "#EF4444",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },

  endText: {
    color: "white",
    fontWeight: "bold",
  },
});
