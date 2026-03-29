import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
  Animated,
  Alert,
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  updateDoc 
} from "firebase/firestore";
import { db } from "../services/firebase";
import { 
  Feather, 
  MaterialCommunityIcons, 
  Ionicons 
} from "@expo/vector-icons";

const { width } = Dimensions.get("window");

export default function TeacherDashboard({ route, navigation }) {
  // Params with fallbacks
  const { 
    sessionId, 
    subject = "Subject", 
    topic = "Topic", 
    teacherId, 
    teacherName 
  } = route.params || {};
  
  const sId = String(sessionId);

  const [sessionStatus, setSessionStatus] = useState("setup"); 
  const [activeTab, setActiveTab] = useState("dashboard");
  const [questions, setQuestions] = useState({}); // Changed to object for concept grouping
  const [stats, setStats] = useState({ gotIt: 0, sortOf: 0, lost: 0, total: 0, raw: { gotIt: 0, sortOf: 0, lost: 0 } });
  const [connectedCount, setConnectedCount] = useState(0);

  // Summary States from Teammate
  const [finalSummary, setFinalSummary] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // --- Real-time Listeners ---
  useEffect(() => {
    if (!sId) return;

    // 1. Session Metadata (Live Count & Topic)
    const unsubSession = onSnapshot(doc(db, "sessions", sId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConnectedCount(data.totalJoined || 0); 
      }
    });

    // 2. Concept-based Live Questions
    const qQuestions = query(
      collection(db, "questions"),
      where("sessionId", "==", sId),
      where("isActive", "==", true)
    );

    const unsubQuestions = onSnapshot(qQuestions, (snapshot) => {
      let data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // 🔥 Sorting logic: Concept-wise categorization
      const grouped = {};
      data.forEach(q => {
        const tag = q.conceptTag || "General Clarification";
        if (!grouped[tag]) grouped[tag] = [];
        grouped[tag].push(q);
      });
      setQuestions(grouped);
    });

    // 3. Signal Stats (Progress Bars)
    const unsubStats = onSnapshot(doc(db, "responses", sId), (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        const total = (d.gotIt || 0) + (d.sortOf || 0) + (d.lost || 0) || 1;
        setStats({
          gotIt: Math.round(((d.gotIt || 0) / total) * 100),
          sortOf: Math.round(((d.sortOf || 0) / total) * 100),
          lost: Math.round(((d.lost || 0) / total) * 100),
          total: (d.gotIt || 0) + (d.sortOf || 0) + (d.lost || 0),
          raw: d
        });
      }
    });

    return () => {
      unsubSession();
      unsubQuestions();
      unsubStats();
    };
  }, [sId]);

  // --- Actions ---
  const handleEndSession = () => {
    // 🔥 Logical Constraint: End only if queue is empty
    const hasActiveQuestions = Object.values(questions).some(arr => arr.length > 0);
    if (hasActiveQuestions) {
      Alert.alert(
        "Questions Pending", 
        "Bhai, pehle saare student questions clear karo (Mark as Done) phir hi session end hoga!"
      );
      return;
    }
    setSessionStatus("ended"); 
  };

  const dismissQuestion = async (qId) => {
    await updateDoc(doc(db, "questions", qId), { isActive: false });
  };

  const handleGetSummary = async () => {
    try {
      setLoadingSummary(true);
      const res = await fetch("https://ankkkkk.app.n8n.cloud/webhook-test/sessionsummary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sId })
      });
      const data = await res.json();
      setFinalSummary(data.data || []); 
      setSessionStatus("summary");
    } catch (err) {
      console.error("❌ API Error:", err);
    } finally {
      setLoadingSummary(false);
    }
  };

  // --- UI RENDERERS (Original Beautiful UI) ---

  const renderSetup = () => (
    <View style={styles.centerContent}>
      <Text style={styles.setupHeader}>Session is Ready</Text>
      <View style={styles.qrCard}>
        <Text style={styles.labelSmall}>ACCESS CODE</Text>
        <Text style={styles.bigCode}>{sId}</Text>
        <View style={styles.qrContainer}>
          <Image source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${sId}` }} style={styles.qrImage} />
        </View>
        <View style={styles.sessionBrief}>
          <Text style={styles.briefSubject}>{subject}</Text>
          <Text style={styles.briefTopic}>{topic}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.primaryBtn} onPress={() => setSessionStatus("active")}>
        <Ionicons name="play-circle" size={24} color="white" />
        <Text style={styles.primaryBtnText}>Start Live Session</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 }}>
        <View style={[styles.pulseDot, { backgroundColor: '#10B981' }]} />
        <Text style={{ color: '#10B981', fontWeight: 'bold' }}>{connectedCount} students joined</Text>
      </View>
    </View>
  );

  const renderActive = () => (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      {activeTab === "dashboard" ? (
        <>
          <View style={styles.headerRow}>
            <View><Text style={styles.mainTitle}>Understanding</Text><Text style={styles.topicTag}>{topic}</Text></View>
            <View style={styles.activeIndicator}>
              <View style={styles.pulseDot} /><Text style={styles.liveText}>{connectedCount} ONLINE</Text>
            </View>
          </View>
          <View style={styles.statsCard}>
            <ProgressBar label={`Got it (${stats.raw.gotIt})`} value={stats.gotIt} color="#22C55E" />
            <ProgressBar label={`Sort of (${stats.raw.sortOf})`} value={stats.sortOf} color="#F59E0B" />
            <ProgressBar label={`Lost (${stats.raw.lost})`} value={stats.lost} color="#EF4444" />
            <View style={[styles.aiInsightBox, { backgroundColor: stats.lost > 30 ? "#EF4444" : "#4338CA" }]}>
              <MaterialCommunityIcons name="chart-bubble" size={20} color="white" />
              <Text style={styles.aiInsightText}>{stats.lost > 30 ? "High confusion detected! Recap recommended." : "Class pace looks good!"}</Text>
            </View>
          </View>
          <View style={styles.miniStatsRow}>
            <MiniStat label="ACTIVE QUESTIONS" value={Object.values(questions).flat().length} />
            <MiniStat label="SESSION ID" value={sId} />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Question Panel</Text>
          {Object.keys(questions).length === 0 ? (
            <View style={styles.emptyState}><Feather name="coffee" size={50} color="#CBD5E1" /><Text style={styles.emptyText}>No pending questions.</Text></View>
          ) : (
            Object.keys(questions).map((concept) => (
              <View key={concept} style={{ marginBottom: 25 }}>
                <View style={styles.conceptHeader}><Text style={styles.conceptTitle}>{concept.toUpperCase()}</Text></View>
                {questions[concept].map((q) => (
                  <QuestionCard key={q.id} count={q.count} text={q.text} type={q.type} onDismiss={() => dismissQuestion(q.id)} />
                ))}
                <View style={styles.horizontalLine} />
              </View>
            ))
          )}
        </>
      )}
      <TouchableOpacity style={styles.endBtn} onPress={handleEndSession}><Text style={styles.endBtnText}>End Session</Text></TouchableOpacity>
    </ScrollView>
  );

  const renderEnded = () => (
    <View style={styles.centerContent}>
      <MaterialCommunityIcons name="flag-checkered" size={80} color="#000066" />
      <Text style={styles.summaryTitle}>Session Ended</Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={handleGetSummary} disabled={loadingSummary}>
        {loadingSummary ? <ActivityIndicator color="white" /> : <Text style={styles.primaryBtnText}>Show Session Report</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={[styles.endBtn, { marginTop: 20 }]} onPress={() => navigation.navigate("CreateRoom", { teacherId, teacherName })}>
        <Text style={styles.endBtnText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSummary = () => (
    <ScrollView contentContainerStyle={styles.centerContent}>
      <Text style={styles.summaryTitle}>Analytics Report</Text>
      {finalSummary.map((item, index) => (
        <View key={index} style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{item.question || "Topic Activity"}</Text>
          <View style={styles.summaryValues}>
            <Text style={{color: '#EF4444'}}>Lost: {item.lost}</Text>
            <Text style={{color: '#F59E0B'}}>Sort: {item.sortOf}</Text>
            <Text style={{color: '#22C55E'}}>Got: {item.gotIt}</Text>
          </View>
        </View>
      ))}
      <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate("CreateRoom", { teacherId, teacherName })}>
        <Text style={styles.primaryBtnText}>Finish</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.navHeader}>
        <View style={styles.headerLeft}><Feather name="radio" size={18} color="#000066" /><Text style={styles.headerSessionText}>Live: {sId}</Text></View>
        <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="x-circle" size={24} color="#64748B" /></TouchableOpacity>
      </View>
      {sessionStatus === "setup" && renderSetup()}
      {sessionStatus === "active" && renderActive()}
      {sessionStatus === "ended" && renderEnded()}
      {sessionStatus === "summary" && renderSummary()}
      {sessionStatus === "active" && (
        <View style={styles.bottomNav}>
          <NavTab icon="bar-chart-2" label="STATS" active={activeTab === "dashboard"} onPress={() => setActiveTab("dashboard")} />
          <NavTab icon="message-circle" label="QUESTIONS" active={activeTab === "questions"} onPress={() => setActiveTab("questions")} />
        </View>
      )}
    </SafeAreaView>
  );
}

// --- ORIGINAL STYLES & COMPONENTS ---
function ProgressBar({ label, value, color }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={styles.barHeader}><Text style={styles.barLabel}>{label.toUpperCase()}</Text><Text style={styles.barValue}>{value}%</Text></View>
      <View style={styles.barBg}><View style={[styles.barFill, { width: `${value}%`, backgroundColor: color }]} /></View>
    </View>
  );
}

function QuestionCard({ count, text, type, onDismiss }) {
  const isLost = type === 1;
  return (
    <View style={[styles.questionCard, { borderLeftColor: isLost ? "#EF4444" : "#F59E0B" }]}>
      <View style={[styles.countBox, { backgroundColor: isLost ? "#EF4444" : "#F59E0B" }]}><Text style={styles.countText}>{count}</Text></View>
      <View style={{ flex: 1, paddingHorizontal: 12 }}>
        <Text style={styles.questionText} numberOfLines={2}>{text}</Text>
        <Text style={[styles.priorityTag, { color: isLost ? "#EF4444" : "#F59E0B" }]}>{isLost ? "🔥 URGENT" : "CLARIFICATION"}</Text>
      </View>
      <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}><Feather name="check" size={20} color="#10B981" /></TouchableOpacity>
    </View>
  );
}

function MiniStat({ label, value }) {
  return <View style={styles.miniStatBox}><Text style={styles.miniStatLabel}>{label}</Text><Text style={styles.miniStatValue}>{value}</Text></View>;
}

function NavTab({ icon, label, active, onPress }) {
  return (
    <TouchableOpacity style={styles.navTab} onPress={onPress}>
      <Feather name={icon} size={24} color={active ? "#000066" : "#94A3B8"} /><Text style={[styles.navLabel, active && { color: "#000066" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFF" },
  container: { flex: 1, padding: 20 },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  navHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerSessionText: { fontWeight: '900', fontSize: 16, color: '#000066' },
  setupHeader: { fontSize: 26, fontWeight: '900', marginBottom: 25, color: '#1E293B' },
  qrCard: { backgroundColor: '#F8FAFC', padding: 30, borderRadius: 30, alignItems: 'center', width: '100%', elevation: 4, marginBottom: 30 },
  labelSmall: { fontSize: 12, fontWeight: '900', color: '#64748B', letterSpacing: 1, marginBottom: 8 },
  bigCode: { fontSize: 50, fontWeight: '900', color: '#000066', letterSpacing: 8, marginVertical: 15 },
  qrContainer: { padding: 15, backgroundColor: 'white', borderRadius: 20, elevation: 5 },
  qrImage: { width: 180, height: 180 },
  sessionBrief: { marginTop: 20, alignItems: 'center' },
  briefSubject: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  briefTopic: { fontSize: 14, color: '#64748B' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  mainTitle: { fontSize: 28, fontWeight: '900', color: '#1E293B' },
  topicTag: { fontSize: 14, color: '#6366F1', fontWeight: '700' },
  activeIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', padding: 8, borderRadius: 12 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  liveText: { color: '#EF4444', fontWeight: 'bold', fontSize: 11 },
  statsCard: { backgroundColor: '#F8FAFC', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barLabel: { fontSize: 11, fontWeight: '900', color: '#64748B' },
  barValue: { fontSize: 16, fontWeight: '900' },
  barBg: { height: 12, backgroundColor: '#E2E8F0', borderRadius: 6 },
  barFill: { height: 12, borderRadius: 6 },
  aiInsightBox: { flexDirection: 'row', padding: 18, borderRadius: 18, marginTop: 15, gap: 12 },
  aiInsightText: { color: 'white', fontSize: 13, flex: 1, fontWeight: '600', lineHeight: 18 },
  sectionTitle: { fontSize: 22, fontWeight: '900', marginVertical: 20, color: '#1E293B' },
  questionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 16, borderRadius: 20, marginBottom: 12, elevation: 2, borderLeftWidth: 6 },
  countBox: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  countText: { color: 'white', fontWeight: '900', fontSize: 18 },
  questionText: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  priorityTag: { fontSize: 10, fontWeight: '900', marginTop: 4 },
  dismissBtn: { padding: 10, backgroundColor: '#F1F5F9', borderRadius: 12 },
  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#94A3B8', marginTop: 15, fontWeight: '600' },
  miniStatsRow: { flexDirection: 'row', gap: 15, marginTop: 25 },
  miniStatBox: { flex: 1, backgroundColor: '#F8FAFC', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  miniStatLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8' },
  miniStatValue: { fontSize: 18, fontWeight: '900', color: '#12348aff', marginTop: 4 },
  primaryBtn: { backgroundColor: '#1d3ba8ff', flexDirection: 'row', padding: 20, borderRadius: 20, width: '100%', justifyContent: 'center', alignItems: 'center', gap: 10 },
  primaryBtnText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  endBtn: { backgroundColor: '#FEF2F2', padding: 18, borderRadius: 18, marginTop: 40, alignItems: 'center', borderWidth: 1, borderColor: '#FCA5A5' },
  endBtnText: { color: '#EF4444', fontWeight: '900', fontSize: 16 },
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', height: 85, backgroundColor: 'white', flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingBottom: 20 },
  navTab: { alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 11, fontWeight: 'bold', color: '#94A3B8', marginTop: 4 },
  summaryTitle: { fontSize: 32, fontWeight: '900', marginTop: 20, color: '#071b56ff' },
  summaryCard: { backgroundColor: '#F8FAFC', padding: 20, borderRadius: 15, width: '100%', marginVertical: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  summaryLabel: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  summaryValues: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  conceptHeader: { backgroundColor: '#E0E7FF', padding: 10, borderRadius: 10, marginBottom: 12 },
  conceptTitle: { fontSize: 12, fontWeight: '900', color: '#244cdeff', letterSpacing: 1 },
  horizontalLine: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 15 }
});