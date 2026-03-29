import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  return (
    <LinearGradient colors={['#F8FAFC', '#E0E7FF']} style={styles.container}>
      <View style={styles.headerBox}>
        <Text style={styles.title}>CLASSPULSE</Text>
        <Text style={styles.subtitle}>Intelligent Classroom Feedback</Text>
      </View>

      <TouchableOpacity 
        activeOpacity={0.9}
        style={styles.cardWrapper} 
        onPress={() => navigation.navigate('Login')}
      >
        <LinearGradient colors={['#2f78d8ff', '#0e2a4fff']} style={styles.teacherCard}>
          <MaterialIcons name="person-outline" size={60} color="white" />
          <Text style={styles.cardTitleWhite}>I am a Teacher</Text>
          <Text style={styles.cardSubWhite}>Lead and analyze live sessions</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity 
        activeOpacity={0.9}
        style={styles.cardWrapper} 
        onPress={() => navigation.navigate('User')}
      >
        <View style={styles.studentCard}>
          <MaterialIcons name="school" size={60} color="#000066" />
          <Text style={styles.cardTitleBlue}>I am a Student</Text>
          <Text style={styles.cardSubBlue}>Join the feed and share feedback</Text>
        </View>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 25 },
  headerBox: { alignItems: 'center', marginBottom: 50 },
  title: { fontSize: 36, fontWeight: '900', color: '#000066', letterSpacing: -1 },
  subtitle: { fontSize: 16, color: '#64748B', fontWeight: '600' },
  cardWrapper: { width: '100%', marginBottom: 20 },
  teacherCard: { padding: 30, borderRadius: 32, alignItems: 'center', elevation: 12, shadowColor: '#000066', shadowOpacity: 0.3, shadowRadius: 20 },
  studentCard: { padding: 30, borderRadius: 32, alignItems: 'center', backgroundColor: 'white', borderWidth: 1, borderColor: '#E2E8F0', elevation: 4 },
  cardTitleWhite: { color: 'white', fontSize: 24, fontWeight: '900', marginTop: 15 },
  cardSubWhite: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 5 },
  cardTitleBlue: { color: '#000066', fontSize: 24, fontWeight: '900', marginTop: 15 },
  cardSubBlue: { color: '#64748B', fontSize: 13, marginTop: 5 },
});