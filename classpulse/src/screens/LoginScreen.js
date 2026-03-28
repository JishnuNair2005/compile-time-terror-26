import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import {collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
        alert("Enter email and password");
        return;
    }

    try {
        // 🔍 Check if teacher already exists
        const q = query(collection(db, "teachers"), where("name", "==", email));
        const snapshot = await getDocs(q);

        let teacherId;

        if (snapshot.empty) {
            // ➕ Create new teacher
            const docRef = await addDoc(collection(db, "teachers"), {
                name: email
            });
            teacherId = docRef.id;
        } else {
        // ♻️ Existing teacher
            teacherId = snapshot.docs[0].id;
        }

        console.log("Teacher logged in:", teacherId);
        navigation.navigate("CreateRoom", { teacherId, teacherName: email });

    } catch (err) {
        console.error(err);
        alert("Login failed");
    }
    };

  return (
    <View style={styles.container}>

      <Text style={styles.title}>Teacher Login</Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.btnText}>Login</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
    justifyContent: 'center',
    padding: 20
  },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000066',
    marginBottom: 20
  },

  input: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10
  },

  button: {
    backgroundColor: '#000066',
    padding: 15,
    borderRadius: 10,
    marginTop: 10
  },

  btnText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold'
  }
});