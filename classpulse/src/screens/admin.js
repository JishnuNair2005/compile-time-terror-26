import React, { useState, useEffect, useRef } from "react";
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
  Alert,
  Platform,
  Vibration // 🔥 Add this!
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  getDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../services/firebase";
import {
  Feather,
  MaterialCommunityIcons,
  Ionicons
} from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get("window");

export default function TeacherDashboard({ route, navigation }) {
  const { 
    sessionId, 
    subject = "Subject", 
    topic = "Topic", 
    teacherId, 
    teacherName,
    expiresAt
  } = route.params || {};
  
  const sId = String(sessionId);

  const [appStage, setAppStage] = useState("setup"); 
  const [activeTab, setActiveTab] = useState("dashboard");
  const [questions, setQuestions] = useState({}); 
  
  // 🔥 ADD THIS LINE BACK IN!
  const [stats, setStats] = useState({ gotIt: 0, sortOf: 0, lost: 0, total: 0, raw: { gotIt: 0, sortOf: 0, lost: 0 } });

  // 🔥 NEW: Separate state for the AI sorted list
  const [smartQuestions, setSmartQuestions] = useState(null); 
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Updated Fetch Function
  const fetchSmartSortedQuestions = async () => {
    setLoadingQuestions(true);
    try {
      // NOTE: Make sure this IP matches your current backend IP!
      const response = await fetch(`http://192.168.1.5:8000/api/sessions/${sId}/questions/smart-sort`);
      const data = await response.json();
      
      if (data.success) {
        setSmartQuestions(data.data); // Save to the new state!
        showCustomAlert("Questions organized by pedagogical priority!", "success");
      }
    } catch (e) {
      console.error("Error fetching sorted questions:", e);
      showCustomAlert("Failed to connect to AI.", "error");
    } finally {
      setLoadingQuestions(false);
    }
  };


  const [connectedCount, setConnectedCount] = useState(0);
  const [isDbSessionActive, setIsDbSessionActive] = useState(true); 
  const [isOfflineMode] = useState(false); 

  const [finalSummary, setFinalSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // --- CUSTOM ALERT STATES ---
  const [customAlert, setCustomAlert] = useState({ visible: false, message: '', type: 'info' });
  const slideAnim = useRef(new Animated.Value(-100)).current;

  // 🔥 NEW: Tracks if the emergency has already triggered so it doesn't spam the buzzer
  const hasTriggeredEmergency = useRef(false);

  const showCustomAlert = (message, type = 'info') => {
    setCustomAlert({ visible: true, message, type });
    Animated.spring(slideAnim, {
      toValue: Platform.OS === 'ios' ? 60 : 40,
      useNativeDriver: true,
      tension: 60,
      friction: 10
    }).start();

    setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 400,
        useNativeDriver: true,
      }).start(() => setCustomAlert({ visible: false, message: '', type: 'info' }));
    }, 3500);
  };
 

  // 🔥 THE AUTO-KILL SWITCH
  useEffect(() => {
    // Only run this if we have an expiration time and the session is still active
    if (!expiresAt || !isDbSessionActive || appStage !== "active") return;

    const timeRemaining = expiresAt - Date.now();

    if (timeRemaining <= 0) {
      // If time is already up (e.g., they re-entered the room late), kill it immediately
      handleEndSession(); 
    } else {
      // Set a timer to kill it exactly when the time runs out
      const killTimer = setTimeout(() => {
        Alert.alert("Time is Up!", "The session duration has expired. Generating summary...");
        handleEndSession(); // This triggers your exact existing End Session function
      }, timeRemaining);

      // Cleanup the timer if they manually end the session early or leave the screen
      return () => clearTimeout(killTimer);
    }
  }, [expiresAt, isDbSessionActive, appStage]);
  const getAlertIcon = () => {
    switch (customAlert.type) {
      case 'success': return { name: 'check', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
      case 'error': return { name: 'x', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' };
      default: return { name: 'info', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' };
    }
  };
  const alertTheme = getAlertIcon();

  // --- REAL-TIME LISTENERS ---
  useEffect(() => {
    if (!sId) return;

    const unsubSession = onSnapshot(doc(db, "sessions", sId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConnectedCount(data.totalJoined || 0); 
        setIsDbSessionActive(data.isActive === true); 
        
        if (data.isActive === false && appStage === "setup") {
            setAppStage("summary");
        }
      }
    });

    const qQuestions = query(
      collection(db, "questions"),
      where("sessionId", "==", sId),
      where("isActive", "==", true)
    );

    const unsubQuestions = onSnapshot(qQuestions, (snapshot) => {
      let data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const grouped = {};
      data.forEach(q => {
        const concept = q.conceptTag || "General Clarification";
        if (!grouped[concept]) {
          grouped[concept] = [];
        }
        grouped[concept].push(q);
      });

      Object.keys(grouped).forEach(key => {
        grouped[key].sort((a, b) => (b.type === 1 ? 1 : -1) || (b.count || 1) - (a.count || 1));
      });

      setQuestions(grouped);
    });

    const unsubStats = onSnapshot(doc(db, "responses", sId), (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        const total = (d.gotIt || 0) + (d.sortOf || 0) + (d.lost || 0) || 1;
        
        // Update your UI stats
        setStats({
          gotIt: Math.round(((d.gotIt || 0) / total) * 100),
          sortOf: Math.round(((d.sortOf || 0) / total) * 100),
          lost: Math.round(((d.lost || 0) / total) * 100),
          total: (d.gotIt || 0) + (d.sortOf || 0) + (d.lost || 0),
          raw: d
        });

        // 🔥 THE EMERGENCY BUZZER LOGIC
        if (d.emergencyAlert === true && hasTriggeredEmergency.current === false) {
          // 1. Show the visual alert on screen
          showCustomAlert("⚠️ CRITICAL: High confusion detected! Pause to recap.", "error");
          
          // 2. Trigger the physical buzz! 
          // Pattern: [Wait 0ms, Buzz 500ms, Wait 200ms, Buzz 500ms]
          Vibration.vibrate([0, 500, 200, 500]); 
          
          // 3. Lock it so it doesn't buzz every time a new student votes
          hasTriggeredEmergency.current = true; 
        } 
        else if (d.emergencyAlert === false && hasTriggeredEmergency.current === true) {
          // 4. The class calmed down (backend removed the flag). Unlock the buzzer for the future.
          hasTriggeredEmergency.current = false;
        }
      }
    });

    return () => {
      unsubSession();
      unsubQuestions();
      unsubStats();
    };
  }, [sId, appStage]);

  useEffect(() => {
    if (!isDbSessionActive && appStage === "active") {
      setAppStage("summary");
      if (!isOfflineMode && !finalSummary) { 
        handleGetSummary();
      }
    }
  }, [isDbSessionActive, appStage, isOfflineMode, finalSummary]);

  // --- 🔥 LIVE SUMMARY GENERATOR ENGINE ---
  const getLiveSummary = () => {
    if (stats.total === 0) return { text: "Waiting for student responses...", color: "#64748B", gradient: ['#F1F5F9', '#F8FAFC'] };

    // 1. Find the concept causing the most confusion
    let topConcept = null;
    let maxCount = 0;
    
    Object.entries(questions).forEach(([concept, qArray]) => {
      const conceptCount = qArray.reduce((sum, q) => sum + (q.count || 1), 0);
      if (conceptCount > maxCount) {
        maxCount = conceptCount;
        topConcept = concept;
      }
    });

    // 2. Determine sentiment based on real-time stats
    const lostPercent = stats.lost;
    const gotItPercent = stats.gotIt;

    if (lostPercent > 40) {
      const extra = topConcept ? ` They are mostly struggling with "${topConcept}".` : " General recap recommended.";
      return { 
        text: `High confusion detected!${extra}`, 
        color: "#EF4444",
        icon: "alert-triangle",
        gradient: ['#FEF2F2', '#FEE2E2']
      };
    } else if (lostPercent > 20) {
      const extra = topConcept ? ` Keep an eye on "${topConcept}".` : " Proceed with slight caution.";
      return { 
        text: `Class pace is okay, but some students are slipping.${extra}`, 
        color: "#F59E0B",
        icon: "activity",
        gradient: ['#FFFBEB', '#FEF3C7']
      };
    } else if (gotItPercent > 70) {
      const extra = topConcept ? ` A few minor doubts on "${topConcept}", but otherwise perfect.` : " They are tracking perfectly!";
      return { 
        text: `Excellent momentum!${extra}`, 
        color: "#10B981",
        icon: "trending-up",
        gradient: ['#ECFDF5', '#D1FAE5']
      };
    } else {
      const extra = topConcept ? ` Main bottleneck seems to be "${topConcept}".` : " Keep explaining the core concept.";
      return { 
        text: `Mixed responses in the room.${extra}`, 
        color: "#3B82F6",
        icon: "radio",
        gradient: ['#EFF6FF', '#DBEAFE']
      };
    }
  };

  const liveInsight = getLiveSummary();

  // --- ACTIONS ---
  const handleEndSession = async () => {
    const hasActiveQuestions = Object.values(questions).some(arr => arr.length > 0);
    if (hasActiveQuestions) {
      showCustomAlert("Bhai, pehle saare student questions clear karo!", "error");
      return;
    }
    
    try {
      await updateDoc(doc(db, "sessions", sId), { 
        isActive: false,
        endedAt: serverTimestamp(),
        finalGotIt: stats.raw.gotIt || 0,
        finalLost: stats.raw.lost || 0,
        totalQuestionsAsked: 0 
      });
      showCustomAlert("Session Ended", "success");
    } catch (error) {
      showCustomAlert("Could not end session.", "error");
    }
  };

  const dismissQuestion = async (qId) => {
    try {
      await updateDoc(doc(db, "questions", qId), { isActive: false });
    } catch (error) {
      showCustomAlert("Could not dismiss question.", "error");
    }
  };

  const handleGetSummary = async () => {
    if (isOfflineMode) return;
    try {
      setLoadingSummary(true);
      
      const sessionRef = doc(db, "sessions", sId);
      const sessionSnap = await getDoc(sessionRef);
      
      if (sessionSnap.exists() && sessionSnap.data().aiSummaryCache) {
        setFinalSummary(sessionSnap.data().aiSummaryCache);
        return; 
      }

      const res = await fetch(`http://192.168.1.5:8000/api/sessions/${sId}/summary`);
      const data = await res.json();
      
      if (data.success) {
        setFinalSummary(data.data || null);
        await updateDoc(sessionRef, { aiSummaryCache: data.data });
      } else {
        throw new Error("Backend failed to return success");
      }
    } catch (err) {
      showCustomAlert("Could not generate AI summary at this time.", "error");
    } finally {
      setLoadingSummary(false);
    }
  };

  

  // --- UI RENDERERS ---
  const renderAlert = () => {
    if (!customAlert.visible) return null;
    return (
      <Animated.View style={[styles.customAlertBox, { transform: [{ translateY: slideAnim }] }]}>
        <View style={[styles.alertIconContainer, { backgroundColor: alertTheme.bg }]}>
          <Feather name={alertTheme.name} color={alertTheme.color} size={16} />
        </View>
        <Text style={styles.customAlertText}>{customAlert.message}</Text>
      </Animated.View>
    );
  };

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
      <TouchableOpacity style={styles.primaryBtn} onPress={() => {
        setAppStage("active");
        showCustomAlert("Session Started! Waiting for students...", "success");
      }}>
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
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {activeTab === "dashboard" ? (
          <>
            <View style={styles.headerRow}>
              <View><Text style={styles.mainTitle}>Understanding</Text><Text style={styles.topicTag}>{topic}</Text></View>
              <View style={[styles.activeIndicator, { backgroundColor: isDbSessionActive ? '#ECFDF5' : '#F1F5F9' }]}>
                <View style={[styles.pulseDot, { backgroundColor: indicatorColor }]} />
                <Text style={[styles.liveText, { color: indicatorColor }]}>{isDbSessionActive ? `${connectedCount} ONLINE` : 'OFFLINE'}</Text>
              </View>
            </View>

            {/* 🔥 NEW LIVE PULSE CHAT SUMMARY */}
            <LinearGradient colors={liveInsight.gradient} style={styles.liveSummaryBox}>
              <View style={styles.liveSummaryHeader}>
                <MaterialCommunityIcons name="google-circles-extended" size={16} color={liveInsight.color} />
                <Text style={[styles.liveSummaryTitle, { color: liveInsight.color }]}>LIVE PULSE SUMMARY</Text>
              </View>
              <View style={styles.liveSummaryContent}>
                <Feather name={liveInsight.icon || 'activity'} size={24} color={liveInsight.color} style={{ marginRight: 12, marginTop: 2 }} />
                <Text style={[styles.liveSummaryText, { color: '#1E293B' }]}>{liveInsight.text}</Text>
              </View>
            </LinearGradient>

            <View style={styles.statsCard}>
              <ProgressBar label={`Got it (${stats.raw.gotIt})`} value={stats.gotIt} color="#22C55E" />
              <ProgressBar label={`Sort of (${stats.raw.sortOf})`} value={stats.sortOf} color="#F59E0B" />
              <ProgressBar label={`Lost (${stats.raw.lost})`} value={stats.lost} color="#EF4444" />
            </View>

            <View style={styles.miniStatsRow}>
              <MiniStat label="ACTIVE QUESTIONS" value={Object.values(questions).flat().length} />
              <MiniStat label="SESSION ID" value={sId} />
            </View>
          </>
       ) : (
          <>
            {/* 🔥 NEW HEADER WITH AI BUTTON */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 15 }}>
              <Text style={[styles.sectionTitle, { marginVertical: 0 }]}>Question Panel</Text>
              <TouchableOpacity style={styles.smartSortBtn} onPress={fetchSmartSortedQuestions}>
                <Feather name="cpu" size={16} color="white" />
                <Text style={styles.smartSortBtnText}>AI Sort</Text>
              </TouchableOpacity>
            </View>

            {loadingQuestions ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color="#000066" />
                <Text style={styles.emptyText}>AI is analyzing teaching order...</Text>
              </View>
            ) : smartQuestions ? (
              
              // 🔥 THE NEW AI-SORTED VIEW
              <View>
                <View style={{ backgroundColor: '#EEF2FF', padding: 12, borderRadius: 10, marginBottom: 15 }}>
                  <Text style={{ color: '#4338CA', fontSize: 12, fontWeight: 'bold', textAlign: 'center' }}>
                    Sorted by Foundational Concepts ➔ Advanced 
                  </Text>
                </View>
                
                {smartQuestions.length === 0 && <Text style={styles.emptyText}>No questions to sort.</Text>}
                
                {smartQuestions.map((q, index) => (
                  <View key={`${q.id}-${index}`} style={styles.smartQuestionCard}>
                    <View style={styles.qHeader}>
                      <View style={styles.conceptBadge}>
                        <Text style={styles.conceptText}>{q.conceptTag || "General"}</Text>
                      </View>
                      <View style={[styles.countBadge, q.count > 1 ? {backgroundColor: '#FEF2F2', borderColor: '#FECACA'} : {}]}>
                        <Text style={[styles.countText, q.count > 1 ? {color: '#EF4444'} : {}]}>
                          {q.count > 1 ? `🔥 Asked by ${q.count}` : 'Asked by 1'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.smartQuestionText}>{q.text}</Text>
                    
                    <TouchableOpacity style={styles.resolveBtn} onPress={() => {
                        dismissQuestion(q.id);
                        // Hide it immediately from the smart list to keep UI snappy
                        setSmartQuestions(prev => prev.filter(item => item.id !== q.id));
                    }}>
                      <Feather name="check" size={16} color="#10B981" />
                      <Text style={styles.resolveText}>Mark as Explained</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

            ) : (
              // ⏳ THE ORIGINAL REAL-TIME FEED (Fallback if AI hasn't been clicked yet)
              Object.keys(questions).length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather name="coffee" size={50} color="#CBD5E1" />
                  <Text style={styles.emptyText}>No pending questions.</Text>
                </View>
              ) : (
                Object.entries(questions).map(([concept, questionsArray]) => (
                  <View key={concept} style={{ marginBottom: 25 }}>
                    <View style={styles.conceptHeader}><Text style={styles.conceptTitle}>{concept.toUpperCase()}</Text></View>
                    {questionsArray.map((q) => (
                      <QuestionCard key={q.id} count={q.count} text={q.text} type={q.type} onDismiss={() => dismissQuestion(q.id)} />
                    ))}
                    <View style={styles.horizontalLine} />
                  </View>
                ))
              )
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
        
        {!finalSummary || !finalSummary.topics ? (
          <View style={{ marginTop: 30, padding: 24, backgroundColor: '#F8FAFC', borderRadius: 16, width: '90%' }}>
            <Text style={{ fontSize: 16, color: '#64748B', textAlign: 'center' }}>Raw data is safely stored. AI summary not available or offline.</Text>
          </View>
        ) : (
          <View style={{ width: '100%', alignItems: 'center' }}>
            <View style={{ backgroundColor: '#EEF2FF', padding: 20, borderRadius: 16, width: '90%', marginBottom: 20, marginTop: 10 }}>
               <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#312E81', marginBottom: 8 }}>Overall Insight</Text>
               <Text style={{ fontSize: 14, color: '#4338CA', lineHeight: 20 }}>{finalSummary.overallIdea}</Text>
               
               <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#991B1B', marginTop: 16, marginBottom: 8 }}>Highest Confusion Area</Text>
               <Text style={{ fontSize: 14, color: '#B91C1C', fontWeight: '600' }}>{finalSummary.topDoubt}</Text>
            </View>

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
      {renderAlert()}
      <View style={styles.navHeader}>
        <View style={styles.headerLeft}>
          <Feather name="radio" size={18} color={isDbSessionActive ? "#10B981" : "#94A3B8"} />
          <Text style={[styles.headerSessionText, { color: isDbSessionActive ? "#10B981" : "#94A3B8" }]}>{isDbSessionActive ? 'Active' : 'Offline'}: {sId}</Text>
        </View>
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

function QuestionCard({ count, text, type, onDismiss }) {
  const isLost = type === 1;
  return (
    <View style={[styles.questionCard, { borderLeftColor: isLost ? "#EF4444" : "#F59E0B" }]}>
      <View style={[styles.countBox, { backgroundColor: isLost ? "#EF4444" : "#F59E0B" }]}>
        <Text style={styles.countText}>{count}</Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 12 }}>
        <Text style={styles.questionText} numberOfLines={2}>{text}</Text>
        <Text style={[styles.priorityTag, { color: isLost ? "#EF4444" : "#F59E0B" }]}>
          {isLost ? "🔥 URGENT" : "CLARIFICATION"}
        </Text>
      </View>
      <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
        <Feather name="check" size={20} color="#10B981" />
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

function NavTab({ icon, label, active, onPress }) {
  return (
    <TouchableOpacity style={styles.navTab} onPress={onPress}>
      <Feather name={icon} size={24} color={active ? "#000066" : "#94A3B8"} />
      <Text style={[styles.navLabel, active && { color: "#000066" }]}>{label}</Text>
    </TouchableOpacity>
  );
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  mainTitle: { fontSize: 28, fontWeight: '900', color: '#1E293B' },
  topicTag: { fontSize: 14, color: '#6366F1', fontWeight: '700' },
  activeIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 12 },
  pulseDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontWeight: 'bold', fontSize: 11 },
  
  // 🔥 NEW STYLES FOR LIVE PULSE SUMMARY
  liveSummaryBox: { padding: 20, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  liveSummaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  liveSummaryTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  liveSummaryContent: { flexDirection: 'row', alignItems: 'flex-start' },
  liveSummaryText: { flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 22 },

  statsCard: { backgroundColor: '#F8FAFC', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barLabel: { fontSize: 11, fontWeight: '900', color: '#64748B' },
  barValue: { fontSize: 16, fontWeight: '900' },
  barBg: { height: 12, backgroundColor: '#E2E8F0', borderRadius: 6 },
  barFill: { height: 12, borderRadius: 6 },
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
  miniStatValue: { fontSize: 18, fontWeight: '900', color: '#12348a', marginTop: 4 },
  primaryBtn: { backgroundColor: '#1d3ba8', flexDirection: 'row', padding: 20, borderRadius: 20, width: '90%', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 3 },
  primaryBtnText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  endBtn: { backgroundColor: '#FEF2F2', padding: 18, borderRadius: 18, marginTop: 40, alignItems: 'center', borderWidth: 1, borderColor: '#FCA5A5' },
  endBtnText: { color: '#EF4444', fontWeight: '900', fontSize: 16 },
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', height: 85, backgroundColor: 'white', flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingBottom: 20 },
  navTab: { alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 11, fontWeight: 'bold', color: '#94A3B8', marginTop: 4 },
  summaryTitle: { fontSize: 32, fontWeight: '900', marginTop: 20, color: '#071b56' },
  summaryCard: { backgroundColor: '#F8FAFC', padding: 20, borderRadius: 15, width: '90%', marginVertical: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  summaryLabel: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  summaryValues: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  conceptHeader: { backgroundColor: '#E0E7FF', padding: 10, borderRadius: 10, marginBottom: 12 },
  conceptTitle: { fontSize: 12, fontWeight: '900', color: '#244cde', letterSpacing: 1 },
  horizontalLine: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 15 },
  customAlertBox: { position: 'absolute', top: 0, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 100, gap: 12, zIndex: 9999, elevation: 12, backgroundColor: '#1E293B', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, borderWidth: 1, borderColor: '#334155', maxWidth: '90%' },
  alertIconContainer: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  customAlertText: { color: 'white', fontWeight: '600', fontSize: 14, paddingRight: 8, flexShrink: 1 },
  // 🔥 AI SMART SORT STYLES
  smartSortBtn: {
    flexDirection: 'row',
    backgroundColor: '#6366F1', // Nice vibrant AI purple/blue
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    alignItems: 'center',
    gap: 6,
    elevation: 2,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  smartSortBtnText: { color: 'white', fontWeight: 'bold', fontSize: 12, letterSpacing: 0.5 },
  smartQuestionCard: { backgroundColor: '#FFFFFF', padding: 18, borderRadius: 20, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 3 },
  qHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  conceptBadge: { backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  conceptText: { color: '#4338CA', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  countBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  countText: { color: '#e5e8eb', fontSize: 11, fontWeight: '800' },
  smartQuestionText: { fontSize: 16, color: '#1E293B', lineHeight: 24, marginBottom: 18, fontWeight: '500' },
  resolveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, backgroundColor: '#ECFDF5', borderRadius: 12, borderWidth: 1, borderColor: '#A7F3D0' },
  resolveText: { color: '#10B981', fontWeight: 'bold', fontSize: 14 },
});