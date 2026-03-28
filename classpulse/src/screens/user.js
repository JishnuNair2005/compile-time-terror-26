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
  Dimensions,
  ActivityIndicator,
  Animated
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'; 

const { width } = Dimensions.get('window');

// Your current local backend IP
const API_URL = 'http://192.168.104.109:8000/api/questions'; 

export default function UserScreen() {
  const [isJoined, setIsJoined] = useState(false);
  const [code, setCode] = useState(['', '', '', '']);
  const [status, setStatus] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [confusion, setConfusion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // NEW: State to lock the screen after submission
  const [isLocked, setIsLocked] = useState(false);

  // NEW: State for our custom dark blue rounded alert
  const [customAlert, setCustomAlert] = useState({ visible: false, message: '' });
  
  const [userId] = useState(() => 'user_' + Math.random().toString(36).substring(2, 11));
  const inputRefs = [useRef(), useRef(), useRef(), useRef()];
  const [isOfflineMode, setIsOfflineMode] = useState(false); // NEW: State for toggle

  // Helper function to show the custom rounded dark blue alert
  const showCustomAlert = (message) => {
    setCustomAlert({ visible: true, message });
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setCustomAlert({ visible: false, message: '' });
    }, 3000);
  };

  const handleCodeChange = (text, index) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);
    if (text && index < 3) {
      inputRefs[index + 1].current.focus();
    }
  };

  const onJoin = async () => {
    const sessionCode = code.join('');
    
    // First check if it's 4 digits
    if (sessionCode.length !== 4) {
      showCustomAlert("Please enter a 4-digit code");
      return;
    }
    console.log("Verifying session code:", sessionCode);
    setIsVerifying(true);

    try {
      // Point to the new GET route (removing '/questions' from your API_URL)
      const verifyUrl = API_URL.replace('/questions', `/sessions/${sessionCode}`);
      
      const response = await fetch(verifyUrl);
      const data = await response.json();

      if (response.ok && data.valid) {
        // Success! The session exists.
        showCustomAlert(`Successfully joined session ${sessionCode}!`);
        setIsJoined(true);
      } else {
        // Failed! The session does not exist.
        showCustomAlert("Invalid session code. Please try again.");
        setCode(['', '', '', '']); // Optional: Auto-clear the wrong code
        inputRefs[0].current.focus(); // Send cursor back to first box
      }
    } catch (error) {
      console.error("Network request failed:", error);
      showCustomAlert("Connection Error. Check your Wi-Fi.");
    } finally {
      setIsVerifying(false);
    }
  };

  // NEW: Handle the initial card tap
 const handleStatusPress = (selectedStatus) => {
    if (isLocked) return; // Prevent tapping if locked

    setStatus(selectedStatus);
    
    // Show visual confirmation
    if (selectedStatus === 'clear') {
      showCustomAlert("Selected: Got It");
      // Auto-submit "Got It" since there is no text needed
      submitQuestionToBackend('clear');
    } else if (selectedStatus === 'sort-of') {
      showCustomAlert("Selected: Sort Of");
      setConfusion(''); // Reset text
    } else if (selectedStatus === 'lost') {
      showCustomAlert("Selected: Lost");
      setConfusion(''); // Reset text
    }
  };

  const submitQuestionToBackend = async (overrideStatus = null) => {
    const currentStatus = overrideStatus || status;

    // Validation for 'Lost': strictly requires text
    if (currentStatus === 'lost' && !confusion.trim()) {
      showCustomAlert("Please describe what you are lost on.");
      return;
    }

    // Prepare text and type based on status
    let textToSend = confusion.trim();
    let qType = 1; // Default to 'lost'

    if (currentStatus === 'clear') {
      qType = 2; // 2 for "Got it"
      textToSend = ""; // Send strictly empty text
      
    } else if (currentStatus === 'sort-of') {
      qType = 0; // 0 for "Sort of"
      // textToSend remains exactly what they typed (or "" if they left it blank)
    }

    const payload = {
      sessionId: code.join(''),
      userId: userId,
      text: textToSend, 
      questionType: qType,
      computeMode: isOfflineMode ? 'tfidf' : 'openai' // Sending the toggle state!
    };

    setIsSubmitting(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        showCustomAlert("Response successfully sent!");
        // LOCK THE APP ON SUCCESS
        setIsLocked(true);
      } else {
        const data = await response.json();
        showCustomAlert(data.detail || "Failed to submit.");
      }
    } catch (error) {
      console.error("Network request failed:", error);
      showCustomAlert("Connection Error. Check your Wi-Fi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isJoined) {
    return (
      <View style={styles.container}>
        {/* CUSTOM ALERT COMPONENT */}
        {customAlert.visible && (
          <View style={styles.customAlertBox}>
            <Feather name="info" color="white" size={20} />
            <Text style={styles.customAlertText}>{customAlert.message}</Text>
          </View>
        )}

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
              {isVerifying ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.joinButtonText}>JOIN CLASS</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.qrButton}>
              <MaterialCommunityIcons name="qrcode-scan" color="#64748B" size={20} />
              <Text style={styles.qrButtonText}>SCAN QR CODE</Text>
            </TouchableOpacity>
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
      {/* CUSTOM ALERT COMPONENT */}
      {customAlert.visible && (
        <View style={styles.customAlertBox}>
          <Feather name="info" color="white" size={20} />
          <Text style={styles.customAlertText}>{customAlert.message}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={styles.dashboardHeader}>SELECT STATUS</Text>
          {isLocked && (
            <View style={styles.lockedBadge}>
              <Feather name="lock" color="#000066" size={12} />
              <Text style={styles.lockedText}>RESPONSE LOCKED</Text>
            </View>
          )}
        </View>

        <View style={[styles.statusGrid, isLocked && { opacity: 0.6 }]}>
          {/* Got It Card */}
          <TouchableOpacity 
            onPress={() => handleStatusPress('clear')}
            disabled={isLocked || isSubmitting}
            style={[styles.statusCard, { backgroundColor: '#10B981', opacity: status && status !== 'clear' ? 0.3 : 1 }]} 
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
            onPress={() => handleStatusPress('sort-of')}
            disabled={isLocked || isSubmitting}
            style={[styles.statusCard, { backgroundColor: '#F59E0B', opacity: status && status !== 'sort-of' ? 0.3 : 1 }]} 
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
            onPress={() => handleStatusPress('lost')}
            disabled={isLocked || isSubmitting}
            style={[styles.statusCard, { backgroundColor: '#EF4444', opacity: status && status !== 'lost' ? 0.3 : 1 }]} 
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

        {/* Input section: Visible for both 'lost' and 'sort-of', but hidden if locked */}
        {(status === 'lost' || status === 'sort-of') && !isLocked && (
          <View style={styles.confusionSection}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.confusionTitle}>
                {status === 'lost' ? "What's confusing?" : "Any questions?"}
              </Text>
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
              editable={!isSubmitting}
            />

            <TouchableOpacity 
              style={[
                styles.submitButton,
                (status === 'lost' && !confusion.trim()) || isSubmitting ? { opacity: 0.5 } : {}
              ]}
              onPress={() => submitQuestionToBackend(null)}
              disabled={isSubmitting || (status === 'lost' && !confusion.trim())}
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Feather name="send" color="white" size={20} />
              )}
              <Text style={styles.submitButtonText}>
                {isSubmitting ? "SENDING..." : "SUBMIT QUESTION"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Success Message shown when locked */}
        {isLocked && (
          <View style={styles.successContainer}>
            <Feather name="check-circle" size={40} color="#10B981" />
            <Text style={styles.successTitle}>Response Recorded</Text>
            <Text style={styles.successSubtitle}>Your teacher has received your feedback. Waiting for the next concept check...</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  
  // NEW STYLES FOR THE CUSTOM ALERT
  customAlertBox: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40, // Keeps it away from the notch
    alignSelf: 'center',
    backgroundColor: '#000066', // Dark blue theme
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30, // Rounded box
    gap: 10,
    zIndex: 999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  customAlertText: { color: 'white', fontWeight: 'bold', fontSize: 14, letterSpacing: 0.5 },
  
  // NEW STYLES FOR LOCK STATE
  lockedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 4 },
  lockedText: { fontSize: 10, fontWeight: 'bold', color: '#000066', letterSpacing: 1 },
  successContainer: { marginTop: 40, alignItems: 'center', backgroundColor: '#F8FAFC', padding: 30, borderRadius: 24, borderWidth: 1, borderColor: '#E2E8F0' },
  successTitle: { fontSize: 20, fontWeight: '900', color: '#000066', marginTop: 16, marginBottom: 8 },
  successSubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },

  // Existing Styles
  scrollContent: { padding: 24, paddingTop: 60, paddingBottom: 100 },
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
  dashboardHeader: { fontSize: 14, fontWeight: '900', color: '#64748B', letterSpacing: 2 },
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