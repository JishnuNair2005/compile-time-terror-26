import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet, 
  ActivityIndicator 
} from "react-native";
import { db } from "../services/firebase";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  orderBy 
} from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

export default function CreateRoomScreen({ route, navigation }) {
  const { teacherId, teacherName } = route.params;
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // 1. Fetch Teacher's Session History
  // teacherName ke basis par query karne ke liye
  const fetchHistory = async () => {
    setRefreshing(true);
    try {
      // 1. Agar aapke sessions collection mein 'teacher' field mein naam hai
      const q = query(
        collection(db, "sessions"),
        where("teacher", "==", teacherName) // teacherId ki jagah naam use kiya
      );

      const snap = await getDocs(q);
      const sessions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Manual Sort (In case Index nahi banayi):
      sessions.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
      
      setHistory(sessions);
    } catch (err) {
      console.error("History Fetch Error:", err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [teacherId]);

  // 2. Create New Session Logic
  const handleCreateSession = async () => {
    if (!subject.trim() || !topic.trim()) {
      alert("Please enter both Subject and Topic");
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
      const { doc, setDoc } = require("firebase/firestore"); // Import if needed
      await setDoc(doc(collection(db, "sessions"), generatedId), sessionData);
      await setDoc(doc(db, "responses", generatedId), {
        gotIt: 0,
        sortOf: 0,
        lost: 0,
        sessionId: generatedId
      });

  console.log("✅ Session & Responses created!");
      // 🔥 Initializing 'responses' doc for real-time counters
      // Use setDoc if you want a specific ID, but here sessionId is unique
      navigation.navigate("Admin", { 
        sessionId: generatedId, 
        subject: subject, 
        topic: topic,
        teacherId: teacherName,
        teacherName: teacherName
      });

    } catch (err) {
      console.error("Create Session Error:", err);
      alert("Failed to create session");
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
            placeholder="Subject (e.g. Operating Systems)"
            value={subject}
            onChangeText={setSubject}
            style={styles.input}
          />
        </View>

        <View style={styles.inputGroup}>
          <Feather name="edit-3" size={18} color="#64748B" style={styles.inputIcon} />
          <TextInput
            placeholder="Topic (e.g. Process Scheduling)"
            value={topic}
            onChangeText={setTopic}
            style={styles.input}
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

      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>Your Previous Sessions</Text>
        <TouchableOpacity onPress={fetchHistory}>
          <Feather name="refresh-cw" size={16} color="#000066" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={fetchHistory}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.sessionItem}
            onPress={() => navigation.navigate("Admin", { 
              sessionId: item.sessionId, 
              subject: item.subject, 
              topic: item.topic 
            })}
          >
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionSubject}>{item.subject}</Text>
              <Text style={styles.sessionTopic}>{item.topic}</Text>
            </View>
            <View style={styles.sessionBadge}>
              <Text style={styles.sessionCode}>{item.sessionId}</Text>
            </View>
          </TouchableOpacity>
        )}
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
  
  sessionItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "white", padding: 15, borderRadius: 15, marginBottom: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  sessionInfo: { flex: 1 },
  sessionSubject: { fontSize: 14, fontWeight: "bold", color: "#1E293B" },
  sessionTopic: { fontSize: 12, color: "#64748B", marginTop: 2 },
  sessionBadge: { backgroundColor: "#E0E7FF", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  sessionCode: { color: "#0b275bff", fontWeight: "bold", fontSize: 14 },
  emptyText: { textAlign: "center", color: "#94A3B8", marginTop: 20 }
});