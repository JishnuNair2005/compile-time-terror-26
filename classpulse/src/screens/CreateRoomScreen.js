import React, { useState, useEffect, useCallback } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet, 
  ActivityIndicator,
  Alert
} from "react-native";
import { useFocusEffect } from '@react-navigation/native'; // 🔥 Added for dynamic reloading
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
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // 🔥 NEW: State for grouped history and expanded folders
  const [groupedHistory, setGroupedHistory] = useState({});
  const [expandedSubjects, setExpandedSubjects] = useState({});

  // 1. 🔥 Dynamic Fetch: Runs every time screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [teacherName])
  );

  // 1. Fetch & Group Teacher's Session History
  const fetchHistory = async () => {
    setRefreshing(true);
    try {
      const q = query(
        collection(db, "sessions"),
        where("teacherName", "==", teacherName) // Adjusted to teacherName based on your logic
      );

      const snap = await getDocs(q);
      const sessions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort newest first
      sessions.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      
      // 🔥 GROUP SESSIONS BY SUBJECT
      const grouped = {};
      sessions.forEach(session => {
        const subjName = session.subject || "Uncategorized";
        if (!grouped[subjName]) {
          grouped[subjName] = [];
        }
        grouped[subjName].push(session);
      });

      setGroupedHistory(grouped);
    } catch (err) {
      console.error("History Fetch Error:", err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [teacherName]);

  // 🔥 Toggle Folder Open/Close
  const toggleSubject = (subjectName) => {
    setExpandedSubjects(prev => ({
      ...prev,
      [subjectName]: !prev[subjectName] // Toggle boolean value
    }));
  };

  // 2. Create New Session Logic
  const handleCreateSession = async () => {
    if (!subject.trim() || !topic.trim()) {
      Alert.alert("Error", "Please enter both Subject and Topic");
      return;
    }

    setLoading(true);
    const generatedId = Math.floor(1000 + Math.random() * 9000).toString();

    try {
      const sessionData = {
        sessionId: generatedId,
        teacherId: teacherName,
        teacherName: teacherName,
        subject: subject.trim(),
        topic: topic.trim(),
        createdAt: serverTimestamp(),
        isActive: true,
        totalJoined: 0
      };

      // Add to 'sessions' collection
      await setDoc(doc(collection(db, "sessions"), generatedId), sessionData);
      await setDoc(doc(db, "responses", generatedId), {
        gotIt: 0,
        sortOf: 0,
        lost: 0,
        sessionId: generatedId
      });

      console.log("✅ Session & Responses created!");
      
      // Reset inputs
      setSubject("");
      setTopic("");
      
      navigation.navigate("Admin", { 
        sessionId: generatedId, 
        subject: subject.trim(), 
        topic: topic.trim(),
        teacherId: teacherName,
        teacherName: teacherName 
      });

    } catch (err) {
      console.error("Create Session Error:", err);
      Alert.alert("Error", "Failed to create session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Hello, Prof. {teacherName}</Text>
        <Text style={styles.subText}>Ready for a new lecture?</Text>
      </View>

      {/* Create Room Card */}
      <View style={styles.createCard}>
        <Text style={styles.cardTitle}>Create New Room</Text>
        
        <View style={styles.inputGroup}>
          <Feather name="book" size={18} color="#64748B" style={styles.inputIcon} />
          <TextInput
            placeholder="Subject (e.g. Operating Systems)"
            value={subject}
            onChangeText={setSubject}
            style={styles.input}
            placeholderTextColor="#94A3B8"
          />
        </View>

        <View style={styles.inputGroup}>
          <Feather name="edit-3" size={18} color="#64748B" style={styles.inputIcon} />
          <TextInput
            placeholder="Topic (e.g. Process Scheduling)"
            value={topic}
            onChangeText={setTopic}
            style={styles.input}
            placeholderTextColor="#94A3B8"
          />
        </View>

        <TouchableOpacity 
          style={styles.createBtn} 
          onPress={handleCreateSession}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="white" /> : (
            <>
              <Text style={styles.createBtnText}>GENERATE SESSION</Text>
              <Feather name="arrow-right" size={18} color="white" />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* History Header */}
      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>Your Previous Sessions</Text>
        <TouchableOpacity onPress={fetchHistory}>
          <Feather name="refresh-cw" size={16} color="#000066" />
        </TouchableOpacity>
      </View>

      {/* 🔥 GROUPED FOLDER LIST */}
      <FlatList
        data={Object.entries(groupedHistory)} // Converts object to array of [subjectName, sessionsArray]
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
              {/* Folder Header */}
              <TouchableOpacity 
                style={[styles.folderHeader, isExpanded && styles.folderHeaderActive]} 
                onPress={() => toggleSubject(subjectName)}
              >
                <View style={styles.folderLeft}>
                  <Feather name={isExpanded ? "folder-minus" : "folder"} size={20} color={isExpanded ? "#000066" : "#64748B"} />
                  <Text style={[styles.folderTitle, isExpanded && styles.folderTitleActive]}>
                    {subjectName} <Text style={styles.folderCount}>({sessionsList.length})</Text>
                  </Text>
                </View>
                <Feather name={isExpanded ? "chevron-down" : "chevron-right"} size={20} color="#64748B" />
              </TouchableOpacity>

              {/* Expanded Sessions List */}
              {isExpanded && (
                <View style={styles.expandedContent}>
                  {sessionsList.map((session) => (
                    <TouchableOpacity 
                      key={session.id}
                      style={styles.sessionItem}
                      onPress={() => navigation.navigate("Admin", { 
                        sessionId: session.sessionId, 
                        subject: session.subject, 
                        topic: session.topic,
                        teacherId: teacherName,
                        teacherName: teacherName
                      })}
                    >
                      <View style={styles.sessionInfo}>
                        <Text style={styles.sessionTopic} numberOfLines={1}>
                          {session.topic}
                        </Text>
                        <Text style={styles.sessionDate}>
                          {session.createdAt ? new Date(session.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
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
          <Text style={styles.emptyText}>No sessions found. Create your first one above!</Text>
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
  createCard: { backgroundColor: "white", padding: 20, borderRadius: 20, elevation: 4, marginBottom: 30 },
  cardTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 20, color: "#1E293B" },
  inputGroup: { flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 12, paddingHorizontal: 15, marginBottom: 15 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: 50, fontSize: 14, color: "#1E293B" },
  createBtn: { backgroundColor: "#2569d8ff", height: 55, borderRadius: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 },
  createBtnText: { color: "white", fontWeight: "900", letterSpacing: 1 },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  historyTitle: { fontSize: 18, fontWeight: "bold", color: "#1E293B" },
  emptyText: { textAlign: "center", color: "#94A3B8", marginTop: 20 },

  // 🔥 FOLDER STYLES
  folderContainer: { marginBottom: 12 },
  folderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "white", padding: 18, borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0" },
  folderHeaderActive: { borderColor: "#000066", backgroundColor: "#F1F5F9" },
  folderLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  folderTitle: { fontSize: 16, fontWeight: "bold", color: "#334155" },
  folderTitleActive: { color: "#000066" },
  folderCount: { fontSize: 14, color: "#94A3B8", fontWeight: "normal" },
  
  // Session Items Inside Folders
  expandedContent: { marginTop: 8, gap: 8, paddingLeft: 12 },
  sessionItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "white", padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", borderLeftWidth: 4, borderLeftColor: "#2569d8ff" },
  sessionInfo: { flex: 1, paddingRight: 10 },
  sessionTopic: { fontSize: 15, fontWeight: "bold", color: "#1E293B" },
  sessionDate: { fontSize: 12, color: "#64748B", marginTop: 4 },
  sessionBadge: { backgroundColor: "#E0E7FF", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  sessionCode: { color: "#0b275bff", fontWeight: "bold", fontSize: 14, letterSpacing: 1 }
});