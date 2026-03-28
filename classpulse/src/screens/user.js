import React, { useState, useRef, useEffect } from 'react';
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
  Animated,
  Alert,
  Modal,
  Linking
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const API_URL = 'http://10.111.71.65:8000/api/questions';

export default function UserScreen() {
  const [isJoined, setIsJoined] = useState(false);
  const [code, setCode] = useState(['', '', '', '']);
  const [status, setStatus] = useState(null);
  const [confusion, setConfusion] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isOfflineMode] = useState(false);

  // Timer & Alert States
  const [timeLeft, setTimeLeft] = useState(0);
  const [customAlert, setCustomAlert] = useState({ visible: false, message: '', type: 'info' });
  const [deviceId, setDeviceId] = useState(null);
  const hasScanned = useRef(false);
  useEffect(() => {
    const getDeviceId = async () => {
      let id = await AsyncStorage.getItem("deviceId");

      if (!id) {
        id = "device_" + Math.random().toString(36).substring(2, 12);
        await AsyncStorage.setItem("deviceId", id);
      }

      setDeviceId(id);
    };

    getDeviceId();
  }, []);

  const inputRefs = [useRef(), useRef(), useRef(), useRef()];
  const timerRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;

  // --- CAMERA STATES ---
  const [isScanning, setIsScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // --- TIMER LOGIC ---
  useEffect(() => {
    if (timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isLocked) {
      setIsLocked(false);
      setStatus(null);
      setConfusion('');
      showCustomAlert("Poll reopened. You can vote again.", "info");
    }
    return () => clearInterval(timerRef.current);
  }, [timeLeft, isLocked]);

  // Formats time exactly like the screenshot (e.g., "01 : 30")
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins} : ${secs < 10 ? '0' : ''}${secs}`;
  };

  // --- PREMIUM CUSTOM ALERT ---
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

  const getAlertIcon = () => {
    switch (customAlert.type) {
      case 'success': return { name: 'check', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
      case 'error': return { name: 'x', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' };
      default: return { name: 'info', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' };
    }
  };
  const alertTheme = getAlertIcon();

  const handleCodeChange = (text, index) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);
    if (text && index < 3) inputRefs[index + 1].current.focus();
  };

  const onJoin = async () => {
    const sessionCode = code.join('');
    if (sessionCode.length !== 4) {
      showCustomAlert("Enter a 4-digit code", "error");
      return;
    }
    setIsVerifying(true);
    try {
      const verifyUrl = API_URL.replace('/questions', `/sessions/${sessionCode}`);
      const fetchWithTimeout = (url, options = {}, timeout = 2000) => {
        return Promise.race([
          fetch(url, options),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), timeout)
          )
        ]);
      };
      const response = await fetchWithTimeout(verifyUrl);
      const data = await response.json();
      if (response.ok && data.valid) {
        showCustomAlert(`Joined Session ${sessionCode}`, "success");
        setIsJoined(true);
      } else {
        showCustomAlert("Invalid Session Code", "error");
        setCode(['', '', '', '']);
        inputRefs[0].current.focus();
      }
    } catch (e) {
      showCustomAlert("Network Error", "error");
    } finally {
      setIsVerifying(false);
    }
  };
  const verifySessionInBackground = async (customCodeArray) => {
    const sessionCode = customCodeArray.join('');

    try {
      const verifyUrl = API_URL.replace('/questions', `/sessions/${sessionCode}`);
      const response = await fetch(verifyUrl);
      const data = await response.json();

      if (!(response.ok && data.valid)) {
        // ❌ If invalid → kick user out
        setIsJoined(false);
        setCode(['', '', '', '']);
        showCustomAlert("Invalid Session Code", "error");
      } else {
        showCustomAlert(`Joined Session ${sessionCode}`, "success");
      }
    } catch (e) {
      // 🌐 Network fail → optional fallback
      showCustomAlert("Weak connection, retrying...", "error");
    }
  };
  const openScanner = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        showCustomAlert("Camera permission is required to scan", "error");
        return;
      }
    }
    setIsScanning(true);
  };
  const onJoinWithCode = async (customCodeArray) => {
    const sessionCode = customCodeArray.join('');

    if (sessionCode.length !== 4) {
      showCustomAlert("Invalid scanned code", "error");
      return;
    }

    setIsVerifying(true);
    try {
      const verifyUrl = API_URL.replace('/questions', `/sessions/${sessionCode}`);
      const response = await fetch(verifyUrl);
      const data = await response.json();

      if (response.ok && data.valid) {
        showCustomAlert(`Joined Session ${sessionCode}`, "success");
        setIsJoined(true);
      } else {
        showCustomAlert("Invalid Session Code", "error");
        setCode(['', '', '', '']);
      }
    } catch (e) {
      showCustomAlert("Network Error", "error");
    } finally {
      setIsVerifying(false);
    }
  };
  const handleBarCodeScanned = ({ data }) => {
    if (hasScanned.current) return; // 🚫 BLOCK duplicates
    hasScanned.current = true;

    setIsScanning(false);

    if (data.startsWith('http://') || data.startsWith('https://')) {
      Linking.openURL(data).catch(() => {
        showCustomAlert("Could not open the website link", "error");
      });
    }
    else if (data.length === 4 && !isNaN(data)) {
      const scannedCode = data.split('');
      setCode(scannedCode);

      // 🚀 Instant UI
      setIsJoined(true);
      showCustomAlert("Joining session...", "info");

      verifySessionInBackground(scannedCode);
    }
    else {
      showCustomAlert("Unrecognized QR format", "error");
    }

    // 🔁 Reset after short delay (optional)
    setTimeout(() => {
      hasScanned.current = false;
    }, 2000);
  };

  const handleStatusPress = (selectedStatus) => {
    if (isLocked || status !== null) return;
    const label = selectedStatus === 'clear' ? 'Got It' : selectedStatus === 'sort-of' ? 'Sort Of' : 'Lost';

    Alert.alert(
      "Confirm Status",
      `Confirm "${label}"? This will lock your choice while the teacher clarifies.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => {
            setStatus(selectedStatus);
            if (selectedStatus === 'clear') submitQuestionToBackend('clear');
          }
        }
      ]
    );
  };

  const submitQuestionToBackend = async (overrideStatus = null) => {
    const currentStatus = overrideStatus || status;
    if (currentStatus === 'lost' && !confusion.trim()) {
      showCustomAlert("Description required for 'Lost'", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        sessionId: code.join(''),
        deviceId: deviceId,   // ✅ FIXED
        text: currentStatus === 'clear' ? "" : confusion.trim(),
        questionType: currentStatus === 'clear' ? 2 : currentStatus === 'lost' ? 1 : 0,
        computeMode: isOfflineMode ? 'tfidf' : 'openai'
      };

      const fetchWithTimeout = (url, options = {}, timeout = 5000) => {
        return Promise.race([
          fetch(url, options),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), timeout)
          )
        ]);
      };

      const response = await fetchWithTimeout(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // 1. Parse the JSON response from Python first
      const data = await response.json();

      // 2. Check BOTH that the network didn't fail AND that Python says success=True
      if (response.ok && data.success) {
        showCustomAlert("Feedback Sent!", "success");
        setTimeLeft(90); // Start 1:30 countdown
        setIsLocked(true);
      } else {
        // 3. If AI Bouncer rejected it, show its exact message!
        showCustomAlert(data.message || "irrelevant question", "error");
      }
    } catch (e) {
      showCustomAlert("Connection Error", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- REUSABLE ALERT COMPONENT ---
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

  if (!isJoined) {
    return (
      <View style={styles.container}>
        {/* FULL SCREEN CAMERA MODAL */}
        <Modal visible={isScanning} animationType="slide" transparent={false}>
          <View style={styles.scannerContainer}>
            <CameraView
              style={styles.camera}
              facing="back"
              onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            >
              <View style={styles.scannerOverlay}>
                <TouchableOpacity
                  style={styles.closeScannerBtn}
                  onPress={() => setIsScanning(false)}
                >
                  <Feather name="x" size={32} color="white" />
                </TouchableOpacity>
                <View style={styles.scannerTarget} />
                <Text style={styles.scannerInstructions}>
                  Point at the Teacher's QR Code
                </Text>
              </View>
            </CameraView>
          </View>
        </Modal>
        {renderAlert()}
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
                  onChangeText={(t) => handleCodeChange(t, i)}
                  placeholder="0"
                  placeholderTextColor="#CBD5E1"
                />
              </View>
            ))}
          </View>

          {/* Wrapped in buttonGroup for clean spacing */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity style={styles.joinButton} onPress={onJoin} disabled={isVerifying}>
              {isVerifying ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.joinButtonText}>JOIN CLASS</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.qrButton} onPress={openScanner}>
              <MaterialCommunityIcons name="qrcode-scan" color="#64748B" size={20} />
              <Text style={styles.qrButtonText}>SCAN QR CODE</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      {renderAlert()}
      <ScrollView contentContainerStyle={styles.scrollContent}>

        <View style={styles.headerRow}>
          <Text style={styles.dashboardHeader}>SELECT STATUS</Text>
        </View>

        <View style={[styles.statusGrid, isLocked && { opacity: 0.4 }]}>
          <StatusCard label="CLEAR" title="Got it" color="#10B981" icon="check-circle" active={status === 'clear'} onPress={() => handleStatusPress('clear')} disabled={isLocked || status !== null} />
          <StatusCard label="UNSURE" title="Sort of" color="#F59E0B" icon="waves" active={status === 'sort-of'} onPress={() => handleStatusPress('sort-of')} disabled={isLocked || status !== null} isMCI />
          <StatusCard label="CONFUSED" title="Lost" color="#EF4444" icon="help-circle" active={status === 'lost'} onPress={() => handleStatusPress('lost')} disabled={isLocked || status !== null} />
        </View>

        {/* INPUT SECTION - Hidden when locked */}
        {(status === 'lost' || status === 'sort-of') && !isLocked && (
          <View style={styles.confusionSection}>
            <Text style={styles.confusionTitle}>{status === 'lost' ? "What's confusing?" : "Any questions?"}</Text>
            <TextInput style={styles.textArea} multiline value={confusion} onChangeText={setConfusion} placeholder="Describe your confusion..." textAlignVertical="top" editable={!isSubmitting} />
            <TouchableOpacity style={[styles.submitButton, (status === 'lost' && !confusion.trim()) && { opacity: 0.5 }]} onPress={() => submitQuestionToBackend()} disabled={isSubmitting || (status === 'lost' && !confusion.trim()) || !deviceId}>
              {isSubmitting ? <ActivityIndicator color="white" /> : <><Feather name="send" color="white" size={20} /><Text style={styles.submitButtonText}>SUBMIT QUESTION</Text></>}
            </TouchableOpacity>
          </View>
        )}

        {/* HIGH FIDELITY TIMER CARD - Matches Screenshot */}
        {isLocked && (
          <View style={styles.liveTimerContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <MaterialCommunityIcons name="poll" size={20} color="#A5B4FC" />
              <Text style={styles.liveTimerHeader}>Clarification in Progress</Text>
            </View>
            <Text style={styles.liveTimerSub}>
              The teacher is currently reviewing responses and explaining this concept.
            </Text>

            <View style={styles.timerInnerCard}>
              <View>
                <Text style={styles.timerLabel}>POLL ENDS IN</Text>
                <Text style={styles.timerValue}>{formatTime(timeLeft)}</Text>
              </View>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE NOW</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// --- SUB-COMPONENTS ---
function StatusCard({ label, title, color, icon, active, onPress, disabled, isMCI }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.statusCard, { backgroundColor: color, opacity: active || !disabled ? 1 : 0.2 }]}>
      <View>
        <Text style={styles.cardStatusLabel}>STATUS: {label}</Text>
        <Text style={styles.cardMainText}>{title}</Text>
      </View>
      <View style={styles.iconCircle}>
        {isMCI ? <MaterialCommunityIcons name={icon} color="white" size={32} /> : <Feather name={icon} color="white" size={32} />}
      </View>
    </TouchableOpacity>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  // Premium Modern Alert (Pill Style)
  customAlertBox: {
    position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 100, gap: 12, zIndex: 9999,
    elevation: 12, backgroundColor: '#1E293B', shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 12, borderWidth: 1, borderColor: '#334155'
  },
  alertIconContainer: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  customAlertText: { color: 'white', fontWeight: '600', fontSize: 14, paddingRight: 8 },

  // High Fidelity Timer Card (Based on screenshot)
  liveTimerContainer: {
    backgroundColor: '#000066', // App's main dark blue
    borderRadius: 20,
    padding: 24,
    marginTop: 24,
    shadowColor: '#000066', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 15, elevation: 8
  },
  liveTimerHeader: { color: '#A5B4FC', fontSize: 16, fontWeight: '700' },
  liveTimerSub: { color: '#94A3B8', fontSize: 14, lineHeight: 22, marginBottom: 24 },
  timerInnerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Translucent glass effect
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)'
  },
  timerLabel: { color: '#A5B4FC', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  timerValue: { color: 'white', fontSize: 38, fontWeight: '900', letterSpacing: 2 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  liveText: { color: 'white', fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  // Standard Dashboard Elements
  scrollContent: { padding: 24, paddingTop: 60, paddingBottom: 100 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  dashboardHeader: { fontSize: 14, fontWeight: '900', color: '#64748B', letterSpacing: 2 },

  statusGrid: { gap: 16 },
  statusCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderRadius: 24, height: 115 },
  cardStatusLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 'bold' },
  cardMainText: { color: 'white', fontSize: 32, fontWeight: '900' },
  iconCircle: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 100 },

  confusionSection: { marginTop: 24, padding: 24, backgroundColor: '#F8FAFC', borderRadius: 24, borderWidth: 1, borderColor: '#E2E8F0' },
  confusionTitle: { fontSize: 18, fontWeight: 'bold', color: '#000066', marginBottom: 12 },
  textArea: { backgroundColor: 'white', borderRadius: 12, padding: 16, fontSize: 16, minHeight: 120, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  submitButton: { flexDirection: 'row', backgroundColor: '#000066', padding: 18, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 10 },
  submitButtonText: { color: 'white', fontWeight: 'bold', letterSpacing: 1 },

  // JOIN SCREEN ELEMENTS
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  headerSection: { alignItems: 'center', marginBottom: 50 },
  title: { fontSize: 40, fontWeight: '900', color: '#000066', letterSpacing: -1, marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#64748B', textAlign: 'center', maxWidth: 250, lineHeight: 22 },

  codeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  codeBox: { width: width * 0.18, aspectRatio: 1, backgroundColor: '#F8FAFC', borderRadius: 16, borderBottomWidth: 3, borderBottomColor: '#000066', justifyContent: 'center', alignItems: 'center' },
  codeInput: { fontSize: 32, fontWeight: '900', color: '#000066', width: '100%', textAlign: 'center' },

  buttonGroup: { gap: 16 },
  joinButton: { backgroundColor: '#000066', paddingVertical: 20, borderRadius: 16, alignItems: 'center', elevation: 5 },
  joinButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16, letterSpacing: 2 },

  // QR Button Additions
  qrButton: { flexDirection: 'row', paddingVertical: 20, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E2E8F0', gap: 10 },
  qrButtonText: { color: '#64748B', fontWeight: 'bold', letterSpacing: 1.5 },

  // --- SCANNER STYLES ---
  scannerContainer: { flex: 1, backgroundColor: 'black' },
  camera: { flex: 1 },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeScannerBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 24,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20
  },
  scannerTarget: {
    width: 250,
    height: 250,
    borderWidth: 4,
    borderColor: '#10B981',
    backgroundColor: 'transparent',
    borderRadius: 24,
    marginBottom: 40
  },
  scannerInstructions: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1
  },
});