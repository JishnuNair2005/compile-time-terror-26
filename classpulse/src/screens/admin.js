import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { 
  Feather, 
  MaterialCommunityIcons, 
  Ionicons, 
  FontAwesome5 
} from "@expo/vector-icons";

const { width } = Dimensions.get("window");

export default function TeacherDashboard() {
  const [sessionStatus, setSessionStatus] = useState("setup"); // 'setup', 'active', 'summary'
  const [topicIndex, setTopicIndex] = useState(1);
  const [activeTab, setActiveTab] = useState("dashboard");

  // --- Screens ---

  // 1. SETUP SCREEN (QR Code & Start)
  const renderSetup = () => (
    <View style={styles.centerContent}>
      <Text style={styles.setupHeader}>New Session Ready</Text>
      
      <View style={styles.qrCard}>
        <Text style={styles.labelSmall}>ACCESS CODE</Text>
        <Text style={styles.bigCode}>4 9 2 1</Text>
        
        <View style={styles.qrContainer}>
          <Image 
            source={{ uri: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=4921" }}
            style={styles.qrImage}
          />
        </View>
      </View>

      <Text style={styles.setupSub}>Students scan this to join the live feed.</Text>

      <TouchableOpacity 
        style={styles.primaryBtn} 
        onPress={() => setSessionStatus("active")}
      >
        <Ionicons name="play-circle" size={24} color="white" />
        <Text style={styles.primaryBtnText}>Start Live Session</Text>
      </TouchableOpacity>

      <View style={styles.connectionBadge}>
        <View style={styles.pulseDot} />
        <Text style={styles.connectionText}>28 students connected</Text>
      </View>
    </View>
  );

  // 2. ACTIVE DASHBOARD (Live Monitoring)
  const renderActive = () => (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.mainTitle}>Student Understanding</Text>
          <Text style={styles.topicTag}>TOPIC #{topicIndex}</Text>
        </View>
        <Text style={styles.studentCount}>28 Students</Text>
      </View>

      {/* Progress Section */}
      <View style={styles.statsCard}>
        <View style={styles.progressRow}>
          <ProgressBar label="Got it" value={60} color="#22C55E" />
          <ProgressBar label="Sort of" value={25} color="#F59E0B" />
          <ProgressBar label="Lost" value={15} color="#EF4444" />
        </View>
        
        <View style={styles.aiInsightBox}>
          <MaterialCommunityIcons name="chart-bubble" size={20} color="white" />
          <Text style={styles.aiInsightText}>
            Most students are following. Focus on "Variable Scoping" to clarify for the 'Sort of' group.
          </Text>
          <TouchableOpacity 
            style={styles.nextTopicBtn}
            onPress={() => setTopicIndex(prev => prev + 1)}
          >
            <Text style={styles.nextTopicBtnText}>Next Topic</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Questions Section */}
      <Text style={styles.sectionTitle}>Question Queue</Text>
      <QuestionCard count={8} text="What is a variable?" priority="High" />
      <QuestionCard count={3} text="Can you repeat the example?" priority="Normal" isDismiss />

      {/* Stats Row */}
      <View style={styles.miniStatsRow}>
        <MiniStat label="CLASS PACE" value="Normal" />
        <MiniStat label="DURATION" value="42:10" />
        <MiniStat label="MODE" value="Lecture" />
      </View>

      <TouchableOpacity 
        style={styles.endBtn} 
        onPress={() => setSessionStatus("summary")}
      >
        <Text style={styles.endBtnText}>End Session</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // 3. SUMMARY SCREEN (Post-Class Report)
  const renderSummary = () => (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <Text style={styles.summaryTitle}>Session 4921 Complete</Text>
      <View style={styles.summaryDivider} />

      <View style={styles.gridRow}>
        <SummaryCard label="PEAK CONFUSION" value="10:45 AM" icon="clock-outline" />
        <SummaryCard label="TOTAL QUESTIONS" value="12" icon="message-text-outline" color="#000066" />
        <SummaryCard label="AVG. UNDERSTANDING" value="74%" icon="trending-up" color="#22C55E" />
      </View>

      <View style={styles.chartPlaceholder}>
        <Text style={styles.labelSmall}>UNDERSTANDING TREND</Text>
        <View style={styles.fakeChartLine} />
        <View style={styles.chartLabels}>
          <Text style={styles.chartLabelText}>Start</Text>
          <Text style={styles.chartLabelText}>Peak</Text>
          <Text style={styles.chartLabelText}>End</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.primaryBtn} 
        onPress={() => { setSessionStatus("setup"); setTopicIndex(1); }}
      >
        <Text style={styles.primaryBtnText}>Back to Dashboard</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.navHeader}>
        <View style={styles.headerLeft}>
          <Feather name="radio" size={20} color="#000066" />
          <Text style={styles.headerSessionText}>Session: 4921</Text>
        </View>
        <View style={styles.connectedBadge}>
          <Text style={styles.connectedText}>CONNECTED</Text>
        </View>
      </View>

      {sessionStatus === "setup" && renderSetup()}
      {sessionStatus === "active" && renderActive()}
      {sessionStatus === "summary" && renderSummary()}

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <NavTab icon="layout" label="DASHBOARD" active={activeTab === "dashboard"} onPress={() => setActiveTab("dashboard")} />
        <NavTab icon="message-square" label="QUESTIONS" active={activeTab === "questions"} onPress={() => setActiveTab("questions")} />
        <NavTab icon="grid" label="SESSION" active={activeTab === "session"} onPress={() => setActiveTab("session")} />
      </View>
    </SafeAreaView>
  );
}

// --- Helper Components ---

function ProgressBar({ label, value, color }) {
  return (
    <View style={{ marginBottom: 15 }}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel}>{label.toUpperCase()}</Text>
        <Text style={styles.barValue}>{value}%</Text>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function QuestionCard({ count, text, priority, isDismiss }) {
  return (
    <View style={styles.questionCard}>
      <View style={[styles.countBox, isDismiss && { backgroundColor: '#E2E8F0' }]}>
        <Text style={[styles.countText, isDismiss && { color: '#64748B' }]}>{count}</Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 12 }}>
        <Text style={styles.questionText}>{text}</Text>
        <Text style={styles.priorityText}>{priority === 'High' ? '🔥 PRIORITY HIGH' : 'CLARIFICATION'}</Text>
      </View>
      <TouchableOpacity style={[styles.actionBtn, isDismiss && { backgroundColor: '#F1F5F9' }]}>
        <Text style={[styles.actionBtnText, isDismiss && { color: '#000' }]}>{isDismiss ? 'Dismiss' : 'Answer'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function MiniStat({ label, value }) {
  return (
    <View style={styles.miniStatBox}>
      <Text style={styles.miniStatLabel}>{label}</Text>
      <Text style={styles.miniStatValue}>{value}</Text>
    </View>
  );
}

function SummaryCard({ label, value, icon, color = "#000" }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.miniStatLabel}>{label}</Text>
      <View style={styles.summaryValueRow}>
        <Text style={[styles.summaryValue, { color }]}>{value}</Text>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
    </View>
  );
}

function NavTab({ icon, label, active, onPress }) {
  return (
    <TouchableOpacity style={styles.navTab} onPress={onPress}>
      <Feather name={icon} size={22} color={active ? "#000066" : "#94A3B8"} />
      <Text style={[styles.navLabel, active && { color: "#000066" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFF" },
  container: { flex: 1, padding: 20 },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  
  // Header
  navHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerSessionText: { fontWeight: 'bold', fontSize: 16, color: '#000066' },
  connectedBadge: { backgroundColor: '#E0E7FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  connectedText: { fontSize: 10, fontWeight: '900', color: '#4338CA' },

  // Setup Screen
  setupHeader: { fontSize: 24, fontWeight: 'bold', marginBottom: 30 },
  qrCard: { backgroundColor: '#F8FAFC', padding: 40, borderRadius: 24, alignItems: 'center', width: '100%', elevation: 2 },
  labelSmall: { fontSize: 12, fontWeight: '900', color: '#64748B', letterSpacing: 1, marginBottom: 8 },
  bigCode: { fontSize: 48, fontWeight: '900', color: '#000066', letterSpacing: 10, marginBottom: 30 },
  qrContainer: { padding: 16, backgroundColor: 'white', borderRadius: 16, elevation: 5 },
  qrImage: { width: 180, height: 180 },
  setupSub: { color: '#64748B', textAlign: 'center', marginTop: 20, marginBottom: 40 },
  connectionBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  connectionText: { color: '#10B981', fontWeight: 'bold', fontSize: 14 },

  // Active Dashboard
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 },
  mainTitle: { fontSize: 28, fontWeight: '900', color: '#1E293B' },
  topicTag: { fontSize: 12, fontWeight: '900', color: '#6366F1' },
  studentCount: { color: '#64748B', fontWeight: '500' },
  statsCard: { backgroundColor: '#F8FAFC', borderRadius: 24, padding: 20 },
  aiInsightBox: { backgroundColor: '#4338CA', padding: 20, borderRadius: 20, marginTop: 10 },
  aiInsightText: { color: 'white', fontSize: 14, lineHeight: 20, marginBottom: 15 },
  nextTopicBtn: { backgroundColor: 'white', padding: 12, borderRadius: 12, alignItems: 'center' },
  nextTopicBtnText: { color: '#4338CA', fontWeight: 'bold' },

  // Progress Bars
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barLabel: { fontSize: 10, fontWeight: '900', color: '#64748B' },
  barValue: { fontSize: 18, fontWeight: '900' },
  barBg: { height: 10, backgroundColor: '#E2E8F0', borderRadius: 5 },
  barFill: { height: 10, borderRadius: 5 },

  // Questions
  sectionTitle: { fontSize: 20, fontWeight: '900', marginTop: 32, marginBottom: 16 },
  questionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 16, borderRadius: 20, marginBottom: 12, elevation: 2 },
  countBox: { width: 48, height: 48, backgroundColor: '#000066', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  countText: { color: 'white', fontWeight: '900', fontSize: 18 },
  questionText: { fontSize: 16, fontWeight: 'bold' },
  priorityText: { fontSize: 10, fontWeight: '800', color: '#64748B', marginTop: 4 },
  actionBtn: { backgroundColor: '#22C55E', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  actionBtnText: { color: 'white', fontWeight: 'bold', fontSize: 12 },

  // Mini Stats
  miniStatsRow: { flexDirection: 'row', gap: 12, marginTop: 32 },
  miniStatBox: { flex: 1, backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16 },
  miniStatLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8' },
  miniStatValue: { fontSize: 16, fontWeight: '900', color: '#1E293B', marginTop: 4 },

  // Summary
  summaryTitle: { fontSize: 32, fontWeight: '900', color: '#1E293B', marginTop: 20 },
  summaryDivider: { height: 6, width: 60, backgroundColor: '#000066', borderRadius: 3, marginVertical: 20 },
  gridRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryCard: { flex: 1, backgroundColor: '#F8FAFC', padding: 16, borderRadius: 20, height: 100, justifyContent: 'space-between' },
  summaryValueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  summaryValue: { fontSize: 24, fontWeight: '900' },
  chartPlaceholder: { backgroundColor: '#F8FAFC', padding: 20, borderRadius: 24, marginBottom: 30 },
  fakeChartLine: { height: 150, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: '#E2E8F0', marginVertical: 10 },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  chartLabelText: { fontSize: 10, fontWeight: 'bold', color: '#94A3B8' },

  // Buttons
  primaryBtn: { backgroundColor: '#000066', flexDirection: 'row', padding: 20, borderRadius: 20, width: '100%', justifyContent: 'center', alignItems: 'center', gap: 10 },
  primaryBtnText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  endBtn: { backgroundColor: '#EF4444', padding: 20, borderRadius: 20, marginTop: 40, alignItems: 'center' },
  endBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  // Bottom Nav
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', height: 80, backgroundColor: 'white', flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  navTab: { alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 10, fontWeight: 'bold', color: '#94A3B8', marginTop: 4 }
});