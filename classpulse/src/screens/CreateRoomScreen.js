import React, { useState, useCallback } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet, 
  ActivityIndicator,
  Alert,
  Keyboard
} from "react-native";
import { useFocusEffect } from '@react-navigation/native';
import { db } from "../services/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  doc,
  setDoc
} from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

export default function CreateRoomScreen({ route, navigation }) {
  const { teacherId, teacherName } = route.params;
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState("60"); // 🔥 NEW: Default 60 minutes
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [groupedHistory, setGroupedHistory] = useState({});
  const [expandedSubjects, setExpandedSubjects] = useState({});

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [teacherId])
  );

  const fetchHistory = async () => {
    setRefreshing(true);
    try {
      const q = query(
        collection(db, "sessions"),
        where("teacherId", "==", teacherId) 
      );

      const snap = await getDocs(q);
      const sessions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      sessions.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      
      const grouped = {};
      sessions.forEach(session => {
        const subjName = session.subject ? session.subject.trim() : "Uncategorized";
        if (!grouped[subjName]) {
          grouped[subjName] = [];
        }
        grouped[subjName].push(session);
      });

      const sortedGrouped = Object.keys(grouped).sort().reduce((acc, key) => {
        acc[key] = grouped[key];
        return acc;
      }, {});

      setGroupedHistory(sortedGrouped);
    } catch (err) {
      console.error("History Fetch Error:", err);
      Alert.alert("Error", "Could not load session history.");
    } finally {
      setRefreshing(false);
    }
  };

  const toggleSubject = (subjectName) => {
    setExpandedSubjects(prev => ({
      ...prev,
      [subjectName]: !prev[subjectName]
    }));
  };

  const getTimeSlot = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Morning";
    if (hour < 17) return "Afternoon";
    return "Evening";
  };

  const getDayOfWeek = () => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[new Date().getDay()];
  };

  const handleCreateSession = async () => {
    if (!subject.trim() || !topic.trim()) {
      Alert.alert("Missing Info", "Please enter both a Subject and a Topic.");
      return;
    }

    // 🔥 NEW: Validate duration
    const durationNum = parseInt(duration);
    if (isNaN(durationNum) || durationNum <= 0) {
      Alert.alert("Invalid Time", "Please enter a valid number of minutes.");
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    const generatedId = Math.floor(1000 + Math.random() * 9000).toString();

    try {
      // 🔥 NEW: Calculate exact millisecond it expires
      const expirationTime = Date.now() + (durationNum * 60 * 1000);

      const sessionData = {
        sessionId: generatedId,
        isActive: true, 
        subject: subject.trim(),
        topic: topic.trim(),
        teacherId: teacherId, 
        teacherName: teacherName,
        totalJoined: 0,
        language: "English", 
        dayOfWeek: getDayOfWeek(),
        timeSlot: getTimeSlot(),
        createdAt: serverTimestamp(),
        expiresAt: expirationTime, // 🔥 NEW: Saved to database
        endedAt: null,
        finalGotIt: 0,
        finalLost: 0,
        totalQuestionsAsked: 0,
        aiSummaryCache: null
      };

      await setDoc(doc(collection(db, "sessions"), generatedId), sessionData);
      
      await setDoc(doc(db, "responses", generatedId), {
        sessionId: generatedId,
        gotIt: 0,
        sortOf: 0,
        lost: 0,
        lastActiveAt: serverTimestamp(),
        timeline: [] 
      });

      console.log("✅ Session & Advanced Responses created successfully!");
      
      setSubject("");
      setTopic("");
      setDuration("60"); // Reset
      
      navigation.navigate("Admin", { 
        sessionId: generatedId, 
        subject: sessionData.subject, 
        topic: sessionData.topic,
        teacherId: teacherId,
        teacherName: teacherName,
        expiresAt: expirationTime // Pass it to the next screen!
      });

    } catch (err) {
      console.error("Create Session Error:", err);
      Alert.alert("Error", "Failed to create session. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Hello, Prof. {teacherName}</Text>
        <Text style={styles.subText}>Ready for a new lecture?</Text>
      </View>

      <View style={styles.createCard}>
        <Text style={styles.cardTitle}>Create New Room</Text>
        
        <View style={styles.inputGroup}>
          <Feather name="book" size={18} color="#64748B" style={styles.inputIcon} />
          <TextInput
            placeholder="Subject (e.g. Java, Maths)"
            value={subject}
            onChangeText={setSubject}
            style={styles.input}
            placeholderTextColor="#94A3B8"
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputGroup}>
          <Feather name="edit-3" size={18} color="#64748B" style={styles.inputIcon} />
          <TextInput
            placeholder="Topic (e.g. OOPS, Geometry)"
            value={topic}
            onChangeText={setTopic}
            style={styles.input}
            placeholderTextColor="#94A3B8"
            autoCapitalize="words"
          />
        </View>

        {/* 🔥 NEW: Duration Input Field */}
        <View style={styles.inputGroup}>
          <Feather name="clock" size={18} color="#64748B" style={styles.inputIcon} />
          <TextInput
            placeholder="Duration (Minutes)"
            value={duration}
            onChangeText={setDuration}
            style={styles.input}
            keyboardType="number-pad"
            placeholderTextColor="#94A3B8"
          />
        </View>

        <TouchableOpacity 
          style={[styles.createBtn, loading && styles.createBtnDisabled]} 
          onPress={handleCreateSession}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? <ActivityIndicator color="white" /> : (
            <>
              <Text style={styles.createBtnText}>GENERATE SESSION</Text>
              <Feather name="arrow-right" size={18} color="white" />
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>Your Previous Sessions</Text>
        <TouchableOpacity onPress={fetchHistory} style={{ padding: 4 }}>
          <Feather name="refresh-cw" size={18} color="#000066" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={Object.entries(groupedHistory)}
        keyExtractor={(item) => item[0]}
        refreshing={refreshing}
        onRefresh={fetchHistory}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => {
          const subjectName = item[0];
          const sessionsList = item[1];
          const isExpanded = expandedSubjects[subjectName];

          return (
            <View style={styles.folderContainer}>
              <TouchableOpacity 
                style={[styles.folderHeader, isExpanded && styles.folderHeaderActive]} 
                onPress={() => toggleSubject(subjectName)}
                activeOpacity={0.7}
              >
                <View style={styles.folderLeft}>
                  <Feather name={isExpanded ? "folder-minus" : "folder"} size={20} color={isExpanded ? "#000066" : "#64748B"} />
                  <Text style={[styles.folderTitle, isExpanded && styles.folderTitleActive]}>
                    {subjectName} <Text style={styles.folderCount}>({sessionsList.length})</Text>
                  </Text>
                </View>
                <Feather name={isExpanded ? "chevron-down" : "chevron-right"} size={20} color="#64748B" />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.expandedContent}>
                  {sessionsList.map((session) => (
                    <TouchableOpacity 
                      key={session.id}
                      style={styles.sessionItem}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate("Admin", { 
                        sessionId: session.sessionId, 
                        subject: session.subject, 
                        topic: session.topic,
                        teacherId: teacherId,
                        teacherName: teacherName
                      })}
                    >
                      <View style={styles.sessionInfo}>
                        <Text style={styles.sessionTopic} numberOfLines={1}>
                          {session.topic}
                        </Text>
                        <Text style={styles.sessionDate}>
                          {session.createdAt 
                            ? new Date(session.createdAt.seconds * 1000).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) 
                            : 'Just now'}
                        </Text>
                      </View>
                      <View style={styles.sessionBadge}>
                        <Text style={styles.sessionCode}>{session.sessionId}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          !loading && !refreshing ? (
            <Text style={styles.emptyText}>No sessions found. Create your first one above!</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC", padding: 20 },
  header: { marginBottom: 30 },
  welcomeText: { fontSize: 24, fontWeight: "900", color: "#000066" },
  subText: { fontSize: 14, color: "#64748B", marginTop: 4 },
  createCard: { backgroundColor: "white", padding: 20, borderRadius: 20, elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, marginBottom: 30 },
  cardTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 20, color: "#1E293B" },
  inputGroup: { flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 12, paddingHorizontal: 15, marginBottom: 15 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: 50, fontSize: 14, color: "#1E293B" },
  createBtn: { backgroundColor: "#2569d8", height: 55, borderRadius: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 },
  createBtnDisabled: { opacity: 0.7 },
  createBtnText: { color: "white", fontWeight: "900", letterSpacing: 1 },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  historyTitle: { fontSize: 18, fontWeight: "bold", color: "#1E293B" },
  emptyText: { textAlign: "center", color: "#94A3B8", marginTop: 40, fontStyle: "italic" },

  folderContainer: { marginBottom: 12 },
  folderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "white", padding: 18, borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0" },
  folderHeaderActive: { borderColor: "#000066", backgroundColor: "#F8FAFC" },
  folderLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  folderTitle: { fontSize: 16, fontWeight: "bold", color: "#334155" },
  folderTitleActive: { color: "#000066" },
  folderCount: { fontSize: 14, color: "#94A3B8", fontWeight: "normal" },
  
  expandedContent: { marginTop: 8, gap: 8, paddingLeft: 12 },
  sessionItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "white", padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", borderLeftWidth: 4, borderLeftColor: "#2569d8" },
  sessionInfo: { flex: 1, paddingRight: 10 },
  sessionTopic: { fontSize: 15, fontWeight: "bold", color: "#1E293B" },
  sessionDate: { fontSize: 12, color: "#64748B", marginTop: 6 },
  sessionBadge: { backgroundColor: "#E0E7FF", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  sessionCode: { color: "#0b275b", fontWeight: "bold", fontSize: 14, letterSpacing: 1 }
});