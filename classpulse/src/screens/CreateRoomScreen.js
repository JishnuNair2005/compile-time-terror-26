import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

export default function CreateRoomScreen({ navigation }) {

  const [subject, setSubject] = useState('');
  const [teacher, setTeacher] = useState('');

  const generateCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const handleCreate = async () => {
    const code = generateCode();

    // 🔥 Replace this with Firebase later
    const sessionData = {
      code,
      subject,
      teacher,
      createdAt: Date.now()
    };

    console.log("Session created:", sessionData);

    // 👉 Navigate to QR screen
    navigation.navigate('SessionCreated', { sessionData });
  };

  return (
    <View style={styles.container}>

      <Text style={styles.title}>Create Session</Text>

      <TextInput
        placeholder="Subject"
        value={subject}
        onChangeText={setSubject}
        style={styles.input}
      />

      <TextInput
        placeholder="Teacher Name"
        value={teacher}
        onChangeText={setTeacher}
        style={styles.input}
      />

      <TouchableOpacity style={styles.button} onPress={handleCreate}>
        <Text style={styles.btnText}>Create Room</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F8F9FB' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
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
  btnText: { color: 'white', textAlign: 'center', fontWeight: 'bold' }
});