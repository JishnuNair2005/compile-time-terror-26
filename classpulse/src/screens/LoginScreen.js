import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator,
  Animated
} from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // --- CUSTOM ALERT STATES & REFS ---
  const [customAlert, setCustomAlert] = useState({ visible: false, message: '', type: 'info' });
  const slideAnim = useRef(new Animated.Value(-100)).current;

  // --- CUSTOM ALERT LOGIC ---
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

  const handleLogin = async () => {
    if (!email.trim()) { 
      showCustomAlert("Enter email", "error"); 
      return; 
    }
    
    setLoading(true);
    try {
      const q = query(collection(db, "teachers"), where("name", "==", email.trim()));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) { 
        showCustomAlert("User not found", "error"); 
        setLoading(false);
        return; 
      }
      
      const teacherId = snapshot.docs[0].id;
      
      // Optional: Clear the input before navigating
      setEmail('');
      navigation.navigate("CreateRoom", { teacherId, teacherName: email.trim() });
      
    } catch (err) { 
      console.error(err);
      showCustomAlert("Login failed", "error"); 
    } finally {
      setLoading(false);
    }
  };

  // --- UI RENDERER FOR ALERT ---
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

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      {renderAlert()}
      
      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.subtitle}>Professors only. Sign in to start.</Text>

      <View style={styles.inputContainer}>
        <Feather name="mail" size={20} color="#64748B" style={styles.icon} />
        <TextInput 
          placeholder="Professor Email" 
          value={email} 
          onChangeText={setEmail} 
          style={styles.input} 
          placeholderTextColor="#94A3B8"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputContainer}>
        <Feather name="lock" size={20} color="#64748B" style={styles.icon} />
        <TextInput 
          placeholder="Secret Key" 
          secureTextEntry 
          value={password} 
          onChangeText={setPassword} 
          style={styles.input} 
          placeholderTextColor="#94A3B8" 
        />
      </View>

      <TouchableOpacity activeOpacity={0.8} style={styles.btnWrapper} onPress={handleLogin} disabled={loading}>
        <LinearGradient colors={['#1468b2', '#112858']} start={{x:0, y:0}} end={{x:1, y:0}} style={styles.button}>
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.btnText}>SIGN IN</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', padding: 30 },
  title: { fontSize: 32, fontWeight: '900', color: '#000066' },
  subtitle: { fontSize: 15, color: '#64748B', marginBottom: 40 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 20, borderRadius: 20, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0', height: 65 },
  icon: { marginRight: 15 },
  input: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1E293B' },
  btnWrapper: { marginTop: 25 },
  button: { height: 65, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '900', letterSpacing: 1.5 },
  
  // --- NEW CUSTOM ALERT STYLES ---
  customAlertBox: { position: 'absolute', top: 0, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 100, gap: 12, zIndex: 9999, elevation: 12, backgroundColor: '#1E293B', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, borderWidth: 1, borderColor: '#334155', maxWidth: '90%' },
  alertIconContainer: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  customAlertText: { color: 'white', fontWeight: '600', fontSize: 14, paddingRight: 8, flexShrink: 1 }
});