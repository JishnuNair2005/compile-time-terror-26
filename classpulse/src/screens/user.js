import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  Dimensions
} from 'react-native';
// Using the built-in Expo icons instead of the buggy Lucide package
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'; 

const { width } = Dimensions.get('window');

export default function UserScreen() {
  const [isJoined, setIsJoined] = useState(false);
  const [code, setCode] = useState(['', '', '', '']);
  const [status, setStatus] = useState(null);
  const [confusion, setConfusion] = useState('');
  
  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  const handleCodeChange = (text, index) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);
    if (text && index < 3) {
      inputRefs[index + 1].current.focus();
    }
  };

  const onJoin = () => {
    if (code.join('').length === 4) {
      setIsJoined(true);
    } else {
      alert("Please enter a 4-digit code");
    }
  };

  const handleSubmit = () => {
  if (status === 'lost' && !confusion.trim()) {
    alert("Please describe what you are lost on before submitting.");
    return;
  }

  // If we reach here, it's either 'sort-of' (optional) or 'lost' with text
  console.log("Submitting:", { status, confusion });
  alert("Question submitted successfully!");
  
  // Clear input after success if you want
  setConfusion('');
};

  if (!isJoined) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.headerSection}>
            <Text style={styles.title}>JOIN SESSION</Text>
            <Text style={styles.subtitle}>Enter the 4-digit code from your teacher</Text>
          </View>

          <View style={styles.codeContainer}>
            {code.map((digit, i) => (
              <View key={i} style={styles.codeBox}>
                <TextInput
                  ref={inputRefs[i]}
                  style={styles.codeInput}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={digit}
                  onChangeText={(text) => handleCodeChange(text, i)}
                  placeholder="0"
                  placeholderTextColor="#CBD5E1"
                />
              </View>
            ))}
          </View>

          <View style={styles.buttonGroup}>
            <TouchableOpacity style={styles.joinButton} onPress={onJoin}>
              <Text style={styles.joinButtonText}>JOIN CLASS</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.qrButton}>
              <MaterialCommunityIcons name="qrcode-scan" color="#64748B" size={20} />
              <Text style={styles.qrButtonText}>SCAN QR CODE</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.statusBadge}>
            <View style={styles.pulseDot} />
            <Text style={styles.footerText}>V1.0 - CONNECTED</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
  behavior={Platform.OS === "ios" ? "padding" : "height"} 
  style={styles.container}
>
  <ScrollView contentContainerStyle={styles.scrollContent}>
    <Text style={styles.dashboardHeader}>SELECT STATUS</Text>

    <View style={styles.statusGrid}>
      {/* Got It Card */}
      <TouchableOpacity 
        onPress={() => { setStatus('clear'); setConfusion(''); }}
        style={[styles.statusCard, { backgroundColor: '#10B981' }]} 
      >
        <View>
          <Text style={styles.cardStatusLabel}>STATUS: CLEAR</Text>
          <Text style={styles.cardMainText}>Got it</Text>
        </View>
        <View style={styles.iconCircle}>
          <Feather name="check-circle" color="white" size={32} />
        </View>
      </TouchableOpacity>

      {/* Sort Of Card */}
      <TouchableOpacity 
        onPress={() => setStatus('sort-of')}
        style={[styles.statusCard, { backgroundColor: '#F59E0B' }]} 
      >
        <View>
          <Text style={styles.cardStatusLabel}>STATUS: UNSURE</Text>
          <Text style={styles.cardMainText}>Sort of</Text>
        </View>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="waves" color="white" size={32} />
        </View>
      </TouchableOpacity>

      {/* Lost Card */}
      <TouchableOpacity 
        onPress={() => setStatus('lost')}
        style={[styles.statusCard, { backgroundColor: '#EF4444' }]} 
      >
        <View>
          <Text style={styles.cardStatusLabel}>STATUS: CONFUSED</Text>
          <Text style={styles.cardMainText}>Lost</Text>
        </View>
        <View style={styles.iconCircle}>
          <Feather name="help-circle" color="white" size={32} />
        </View>
      </TouchableOpacity>
    </View>

    {/* Input section: Visible for both 'lost' and 'sort-of' */}
    {(status === 'lost' || status === 'sort-of') && (
      <View style={styles.confusionSection}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={styles.confusionTitle}>
            {status === 'lost' ? "What's confusing?" : "Any questions?"}
          </Text>
          {/* Requirement Badge */}
          <Text style={{ 
            fontSize: 10, 
            fontWeight: '900', 
            color: status === 'lost' ? '#EF4444' : '#64748B',
            letterSpacing: 1
          }}>
            {status === 'lost' ? "REQUIRED" : "OPTIONAL"}
          </Text>
        </View>

        <TextInput
          style={[
            styles.textArea,
            status === 'lost' && !confusion.trim() && { borderColor: '#FECACA', borderWidth: 1 } 
          ]}
          multiline
          numberOfLines={4}
          value={confusion}
          onChangeText={setConfusion}
          placeholder={status === 'lost' ? "Describe your confusion..." : "Anything you'd like to clarify?"}
          textAlignVertical="top"
        />

        <TouchableOpacity 
          style={[
            styles.submitButton,
            status === 'lost' && !confusion.trim() && { opacity: 0.5 } // Visual feedback for disabled state
          ]}
          onPress={() => {
            if (status === 'lost' && !confusion.trim()) {
              alert("Please enter a question. This field is required when 'Lost'.");
              return;
            }
            // Logic for successful submission (e.g., Firebase call)
            alert("Question submitted!");
            setConfusion(''); 
          }}
        >
          <Feather name="send" color="white" size={20} />
          <Text style={styles.submitButtonText}>SUBMIT QUESTION</Text>
        </TouchableOpacity>
      </View>
    )}
  </ScrollView>
</KeyboardAvoidingView>
  );
}

// ... styles remain the same as previous response
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 24, paddingTop: 60 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  headerSection: { alignItems: 'center', marginBottom: 60 },
  title: { fontSize: 48, fontWeight: '900', color: '#000066', letterSpacing: -2 },
  subtitle: { fontSize: 18, color: '#64748B', textAlign: 'center', marginTop: 10, maxWidth: 250, lineHeight: 22 },
  codeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  codeBox: { width: width * 0.18, aspectRatio: 1, backgroundColor: '#F8FAFC', borderRadius: 16, borderBottomWidth: 3, borderBottomColor: '#000066', justifyContent: 'center', alignItems: 'center' },
  codeInput: { fontSize: 32, fontWeight: '900', color: '#000066', width: '100%', textAlign: 'center' },
  buttonGroup: { gap: 16 },
  joinButton: { backgroundColor: '#000066', paddingVertical: 20, borderRadius: 16, alignItems: 'center', elevation: 5 },
  joinButtonText: { color: 'white', fontWeight: 'bold', letterSpacing: 2 },
  qrButton: { flexDirection: 'row', paddingVertical: 20, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E2E8F0', gap: 10 },
  qrButtonText: { color: '#64748B', fontWeight: 'bold', letterSpacing: 1.5 },
  footer: { padding: 40, alignItems: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, gap: 8 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  footerText: { fontSize: 10, fontWeight: 'bold', color: '#64748B', letterSpacing: 1 },
  dashboardHeader: { fontSize: 14, fontWeight: '900', color: '#64748B', letterSpacing: 2, marginBottom: 20 },
  statusGrid: { gap: 16 },
  statusCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderRadius: 24, height: 120 },
  cardStatusLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 'bold', letterSpacing: 1, marginBottom: 4 },
  cardMainText: { color: 'white', fontSize: 32, fontWeight: '900' },
  iconCircle: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 100 },
  confusionSection: { marginTop: 32, padding: 24, backgroundColor: '#F8FAFC', borderRadius: 24, borderWidth: 1, borderColor: '#E2E8F0' },
  confusionTitle: { fontSize: 18, fontWeight: 'bold', color: '#000066', marginBottom: 16 },
  textArea: { backgroundColor: 'white', borderRadius: 12, padding: 16, fontSize: 16, minHeight: 120, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  submitButton: { flexDirection: 'row', backgroundColor: '#000066', padding: 18, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 10 },
  submitButtonText: { color: 'white', fontWeight: 'bold', letterSpacing: 1 }
});