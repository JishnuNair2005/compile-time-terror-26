import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email) { alert("Enter email"); return; }
    try {
      const q = query(collection(db, "teachers"), where("name", "==", email));
      const snapshot = await getDocs(q);
      if (snapshot.empty) { alert("User not found"); return; }
      const teacherId = snapshot.docs[0].id;
      navigation.navigate("CreateRoom", { teacherId, teacherName: email });
    } catch (err) { alert("Login failed"); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.subtitle}>Professors only. Sign in to start.</Text>

      <View style={styles.inputContainer}>
        <Feather name="mail" size={20} color="#64748B" style={styles.icon} />
        <TextInput placeholder="Teacher Name / Email" value={email} onChangeText={setEmail} style={styles.input} placeholderTextColor="#94A3B8" />
      </View>

      <View style={styles.inputContainer}>
        <Feather name="lock" size={20} color="#64748B" style={styles.icon} />
        <TextInput placeholder="Secret Key" secureTextEntry value={password} onChangeText={setPassword} style={styles.input} placeholderTextColor="#94A3B8" />
      </View>

      <TouchableOpacity activeOpacity={0.8} style={styles.btnWrapper} onPress={handleLogin}>
        <LinearGradient colors={['#1468b2ff', '#112858ff']} start={{x:0, y:0}} end={{x:1, y:0}} style={styles.button}>
          <Text style={styles.btnText}>SIGN IN</Text>
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
  btnText: { color: 'white', fontWeight: '900', letterSpacing: 1.5 }
});