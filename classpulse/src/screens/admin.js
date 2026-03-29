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
  ActivityIndicator,
  Alert
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
  const { 
    sessionId, 
    subject = "Subject", 
    topic = "Topic", 
    teacherId, 
    teacherName 
  } = route.params || {};
  
  const sId = String(sessionId);

  // App Stages: "setup" -> "active" -> "summary"
  const [appStage, setAppStage] = useState("setup"); 
  
  // UI States
  const [activeTab, setActiveTab] = useState("dashboard");
  const [questions, setQuestions] = useState({}); // 🔥 State is Object for Concept Grouping
  const [stats, setStats] = useState({ gotIt: 0, sortOf: 0, lost: 0, total: 0, raw: { gotIt: 0, sortOf: 0, lost: 0 } });
  
  // State for real-time student count
  const [connectedCount, setConnectedCount] = useState(0);
  const [isDbSessionActive, setIsDbSessionActive] = useState(true); 
  const [isOfflineMode] = useState(false); 

  // Summary States
  const [finalSummary, setFinalSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // --- Real-time Listeners ---
  useEffect(() => {
    if (!sId) return;

    // 1. Session Metadata & Attendance
    const unsubSession = onSnapshot(doc(db, "sessions", sId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConnectedCount(data.totalJoined || 0); 
        setIsDbSessionActive(data.isActive === true); 
      }
    });

    // 2. 🔥 FIXED: Concept-based Live Questions Logic
    const qQuestions = query(
      collection(db, "questions"),
      where("sessionId", "==", sId),
      where("isActive", "==", true)
    );

    const unsubQuestions = onSnapshot(qQuestions, (snapshot) => {
      let data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // 🔥 Logic: Group questions by conceptTag provided by Llama
      const grouped = {};
      data.forEach(q => {
        const concept = q.conceptTag || "General Clarification";
        if (!grouped[concept]) {
          grouped[concept] = [];
        }
        grouped[concept].push(q);
      });

      // Sort questions within each concept by count/priority
      Object.keys(grouped).forEach(key => {
        grouped[key].sort((a, b) => (b.type === 1 ? 1 : -1) || (b.count || 1) - (a.count || 1));
      });

      setQuestions(grouped);
    });

    // 3. Signal Stats (Got It/Lost Bars)
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

  // Handle stage transition when session ends
  useEffect(() => {
    if (!isDbSessionActive && appStage === "active") {
      setAppStage("summary");
      // Safely check if finalSummary is null
      if (!isOfflineMode && !finalSummary) { 
        handleGetSummary();
      }
    }
  }, [isDbSessionActive, appStage, isOfflineMode, finalSummary]);

  // --- Actions ---
  const handleEndSession = async () => {
    // Ensure all questions are cleared before ending
    const hasActiveQuestions = Object.values(questions).some(arr => arr.length > 0);
    if (hasActiveQuestions) {
      Alert.alert("Questions Pending", "Bhai, pehle saare student questions clear karo!");
      return;
    }
    
    try {
      await updateDoc(doc(db, "sessions", sId), { isActive: false });
    } catch (error) {
      Alert.alert("Error", "Could not end session.");
    }
  };

  const dismissQuestion = async (qId) => {
    await updateDoc(doc(db, "questions", qId), { isActive: false });
  };

  const handleGetSummary = async () => {
    if (isOfflineMode) return;
    try {
      setLoadingSummary(true);
      // 🔥 POINT THIS TO YOUR LOCAL PYTHON SERVER
      const res = await fetch(`http://192.168.104.109:8000/api/sessions/${sId}/summary`);
      
      const data = await res.json();
      if (data.success) {
        setFinalSummary(data.data || null); // Save the entire object
      } else {
        throw new Error("Backend failed to return success");
      }
    } catch (err) {
      console.error("❌ Summary Error:", err);
    } finally {
      setLoadingSummary(false);
    }
  };

  // --- UI RENDERERS ---

  const renderSetup = () => (
    <View style={styles.setupContainer}>
      <Text style={styles.setupHeader}>Session is Ready</Text>
      <View style={styles.qrCard}>
        <Text style={styles.labelSmall}>ACCESS CODE</Text>
        <Text style={styles.bigCode}>{sId}</Text>
        <View style={styles.qrContainer}>
          <Image 
            source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${sId}` }} 
            style={styles.qrImage}
            resizeMode="contain"
          />
        </View>
        <View style={styles.sessionBrief}>
          <Text style={styles.briefSubject}>{subject}</Text>
          <Text style={styles.briefTopic}>{topic}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.primaryBtn} onPress={() => setAppStage("active")}>
        <Ionicons name="play-circle" size={24} color="white" />
        <Text style={styles.primaryBtnText}>Start Live Session</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24 }}>
        <View style={[styles.pulseDot, { backgroundColor: '#10B981' }]} />
        <Text style={{ color: '#10B981', fontWeight: 'bold', fontSize: 16 }}>{connectedCount} students joined</Text>
      </View>
    </View>
  );

  const renderActive = () => {
    const indicatorColor = isDbSessionActive ? '#10B981' : '#94A3B8';
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
        {activeTab === "dashboard" ? (
          <>
            <View style={styles.headerRow}>
              <View><Text style={styles.mainTitle}>Understanding</Text><Text style={styles.topicTag}>{topic}</Text></View>
              <View style={[styles.activeIndicator, { backgroundColor: isDbSessionActive ? '#ECFDF5' : '#F1F5F9' }]}>
                <View style={[styles.pulseDot, { backgroundColor: indicatorColor }]} />
                <Text style={[styles.liveText, { color: indicatorColor }]}>{isDbSessionActive ? `${connectedCount} ONLINE` : 'OFFLINE'}</Text>
              </View>
            </View>
            <View style={styles.statsCard}>
              <ProgressBar label={`Got it (${stats.raw.gotIt})`} value={stats.gotIt} color="#22C55E" />
              <ProgressBar label={`Sort of (${stats.raw.sortOf})`} value={stats.sortOf} color="#F59E0B" />
              <ProgressBar label={`Lost (${stats.raw.lost})`} value={stats.lost} color="#EF4444" />
              <View style={[styles.aiInsightBox, { backgroundColor: stats.lost > 30 ? "#EF4444" : "#4338CA" }]}>
                <MaterialCommunityIcons name="chart-bubble" size={20} color="white" /><Text style={styles.aiInsightText}>{stats.lost > 30 ? "High confusion detected! Recap recommended." : "Class pace looks good!"}</Text>
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
              /* 🔥 FIXED UI LOGIC: Using Object.entries for Concept Mapping */
              Object.entries(questions).map(([concept, questionsArray]) => (
                <View key={concept} style={{ marginBottom: 25 }}>
                  <View style={styles.conceptHeader}><Text style={styles.conceptTitle}>{concept.toUpperCase()}</Text></View>
                  {questionsArray.map((q) => (
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
  };

  const renderSummary = () => {
    if (loadingSummary) {
      return (
        <View style={styles.setupContainer}>
          <ActivityIndicator size="large" color="#000066" />
          <Text style={{ marginTop: 20, color: '#64748B', fontWeight: 'bold' }}>Extracting AI Summary...</Text>
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.scrollCenter}>
        <Text style={styles.summaryTitle}>AI Analytics Report</Text>
        
        {/* Safely check if finalSummary exists and has topics */}
        {!finalSummary || !finalSummary.topics ? (
          <View style={{ marginTop: 30, padding: 24, backgroundColor: '#F8FAFC', borderRadius: 16, width: '90%' }}>
            <Text style={{ fontSize: 16, color: '#64748B', textAlign: 'center' }}>Raw data is safely stored. AI summary not available or offline.</Text>
          </View>
        ) : (
          <View style={{ width: '100%', alignItems: 'center' }}>
            
            {/* 🔥 NEW: Render the Overall AI Idea & Top Doubt */}
            <View style={{ backgroundColor: '#EEF2FF', padding: 20, borderRadius: 16, width: '90%', marginBottom: 20, marginTop: 10 }}>
               <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#312E81', marginBottom: 8 }}>Overall Insight</Text>
               <Text style={{ fontSize: 14, color: '#4338CA', lineHeight: 20 }}>{finalSummary.overallIdea}</Text>
               
               <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#991B1B', marginTop: 16, marginBottom: 8 }}>Highest Confusion Area</Text>
               <Text style={{ fontSize: 14, color: '#B91C1C', fontWeight: '600' }}>{finalSummary.topDoubt}</Text>
            </View>

            {/* 🔥 Render the Clustered Topics Table */}
            {finalSummary.topics.map((item, index) => (
              <View key={index} style={styles.summaryCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                   <Text style={styles.summaryLabel}>{item.topic}</Text>
                   <View style={{ backgroundColor: item.doubtsLevel === 'High' ? '#FEE2E2' : '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                      <Text style={{ color: item.doubtsLevel === 'High' ? '#EF4444' : '#F59E0B', fontWeight: 'bold', fontSize: 12 }}>
                        {item.doubtsLevel.toUpperCase()} DOUBTS
                      </Text>
                   </View>
                </View>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 }}>
                   <Feather name="clock" size={14} color="#64748B" />
                   <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '600' }}>Spike Time: {item.timestamps}</Text>
                </View>
  
                <Text style={{ color: '#1E293B', marginTop: 12, lineHeight: 20 }}>
                  {item.summary}
                </Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={[styles.primaryBtn, { marginTop: 30, width: '90%' }]} onPress={() => navigation.navigate("CreateRoom", { teacherId, teacherName })}>
          <Text style={styles.primaryBtnText}>Finish & Return Home</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.navHeader}>
        <View style={styles.headerLeft}><Feather name="radio" size={18} color={isDbSessionActive ? "#10B981" : "#94A3B8"} /><Text style={[styles.headerSessionText, { color: isDbSessionActive ? "#10B981" : "#94A3B8" }]}>{isDbSessionActive ? 'Active' : 'Offline'}: {sId}</Text></View>
        <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="x-circle" size={24} color="#64748B" /></TouchableOpacity>
      </View>
      {appStage === "setup" && renderSetup()}
      {appStage === "active" && renderActive()}
      {appStage === "summary" && renderSummary()}
      {appStage === "active" && (
        <View style={styles.bottomNav}>
          <NavTab icon="bar-chart-2" label="STATS" active={activeTab === "dashboard"} onPress={() => setActiveTab("dashboard")} />
          <NavTab icon="message-circle" label="QUESTIONS" active={activeTab === "questions"} onPress={() => setActiveTab("questions")} />
        </View>
      )}
    </SafeAreaView>
  );
}

// --- SUB-COMPONENTS ---
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
      <View style={{ flex: 1, paddingHorizontal: 12 }}><Text style={styles.questionText} numberOfLines={2}>{text}</Text><Text style={[styles.priorityTag, { color: isLost ? "#EF4444" : "#F59E0B" }]}>{isLost ? "🔥 URGENT" : "CLARIFICATION"}</Text></View>
      <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}><Feather name="check" size={20} color="#10B981" /></TouchableOpacity>
    </View>
  );
}

function MiniStat({ label, value }) {
  return (<View style={styles.miniStatBox}><Text style={styles.miniStatLabel}>{label}</Text><Text style={styles.miniStatValue}>{value}</Text></View>);
}

function NavTab({ icon, label, active, onPress }) {
  return (<TouchableOpacity style={styles.navTab} onPress={onPress}><Feather name={icon} size={24} color={active ? "#000066" : "#94A3B8"} /><Text style={[styles.navLabel, active && { color: "#000066" }]}>{label}</Text></TouchableOpacity>);
}

// --- STYLES ---
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFF" },
  container: { flex: 1, padding: 20 },
  setupContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  scrollCenter: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  navHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerSessionText: { fontWeight: '900', fontSize: 16 }, 
  setupHeader: { fontSize: 28, fontWeight: '900', marginBottom: 25, color: '#1E293B' },
  qrCard: { backgroundColor: '#F8FAFC', padding: 30, borderRadius: 30, alignItems: 'center', width: '90%', elevation: 4, marginBottom: 30, borderWidth: 1, borderColor: '#E2E8F0' },
  labelSmall: { fontSize: 12, fontWeight: '900', color: '#64748B', letterSpacing: 1, marginBottom: 8 },
  bigCode: { fontSize: 56, fontWeight: '900', color: '#000066', letterSpacing: 10, marginVertical: 15 },
  qrContainer: { padding: 15, backgroundColor: 'white', borderRadius: 20, elevation: 5, width: 200, height: 200, justifyContent: 'center', alignItems: 'center' },
  qrImage: { width: 170, height: 170 },
  sessionBrief: { marginTop: 24, alignItems: 'center' },
  briefSubject: { fontSize: 20, fontWeight: 'bold', color: '#1E293B', textAlign: 'center' },
  briefTopic: { fontSize: 16, color: '#64748B', textAlign: 'center', marginTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  mainTitle: { fontSize: 28, fontWeight: '900', color: '#1E293B' },
  topicTag: { fontSize: 14, color: '#6366F1', fontWeight: '700' },
  activeIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 12 },
  pulseDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontWeight: 'bold', fontSize: 11 },
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
  primaryBtn: { backgroundColor: '#1d3ba8ff', flexDirection: 'row', padding: 20, borderRadius: 20, width: '90%', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 3 },
  primaryBtnText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  endBtn: { backgroundColor: '#FEF2F2', padding: 18, borderRadius: 18, marginTop: 40, alignItems: 'center', borderWidth: 1, borderColor: '#FCA5A5' },
  endBtnText: { color: '#EF4444', fontWeight: '900', fontSize: 16 },
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', height: 85, backgroundColor: 'white', flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingBottom: 20 },
  navTab: { alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 11, fontWeight: 'bold', color: '#94A3B8', marginTop: 4 },
  summaryTitle: { fontSize: 32, fontWeight: '900', marginTop: 20, color: '#071b56ff' },
  summaryCard: { backgroundColor: '#F8FAFC', padding: 20, borderRadius: 15, width: '90%', marginVertical: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  summaryLabel: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  summaryValues: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  conceptHeader: { backgroundColor: '#E0E7FF', padding: 10, borderRadius: 10, marginBottom: 12 },
  conceptTitle: { fontSize: 12, fontWeight: '900', color: '#244cdeff', letterSpacing: 1 },
  horizontalLine: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 15 }
});