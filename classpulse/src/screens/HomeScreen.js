import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons'; // Standard with Expo

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>STOIC SIGNAL</Text>
      <Text style={styles.subtitle}>Select your role to begin</Text>

      {/* Teacher / Admin Button */}
      <TouchableOpacity 
        style={styles.teacherCard} 
        onPress={() => navigation.navigate('Admin')}
      >
        <MaterialIcons name="people-outline" size={50} color="white" />
        <Text style={styles.teacherText}>I am a Teacher</Text>
      </TouchableOpacity>

      {/* Student / User Button */}
      <TouchableOpacity 
        style={styles.studentCard} 
        onPress={() => navigation.navigate('User')}
      >
        <MaterialIcons name="help-outline" size={50} color="#000066" />
        <Text style={styles.studentText}>I am a Student</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000066',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 40,
  },
  teacherCard: {
    backgroundColor: '#000066',
    width: '100%',
    height: 180,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 5, // Shadow for Android
    shadowColor: '#000', // Shadow for iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
  },
  teacherText: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 10,
  },
  studentCard: {
    backgroundColor: '#F0F2F5',
    width: '100%',
    height: 180,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    elevation: 2,
  },
  studentText: {
    color: '#000066',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 10,
  },
});