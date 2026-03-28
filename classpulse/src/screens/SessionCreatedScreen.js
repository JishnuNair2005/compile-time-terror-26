import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function SessionCreatedScreen({ route, navigation }) {
  const { sessionData } = route.params;
  const sessionId = sessionData.sessionId;

  return (
    <SafeAreaView style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>Session Ready</Text>
        <Text style={styles.subtitle}>Share this with students</Text>
      </View>

      {/* CARD */}
      <View style={styles.card}>
        <Text style={styles.label}>ACCESS CODE</Text>
        <Text style={styles.code}>{sessionId}</Text>

        {/* QR */}
        <View style={styles.qrBox}>
          <Image
            source={{
              uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${sessionId}`
            }}
            style={styles.qr}
          />
        </View>
      </View>

      {/* INFO */}
      <Text style={styles.info}>
        Students can scan or enter the code to join instantly
      </Text>

      {/* START BUTTON */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Admin', { sessionId })}
      >
        <Ionicons name="play-circle" size={20} color="white" />
        <Text style={styles.btnText}>Start Live Session</Text>
      </TouchableOpacity>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
    padding: 20,
    justifyContent: 'center'
  },

  header: {
    marginBottom: 20
  },

  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#000066'
  },

  subtitle: {
    color: '#555',
    marginTop: 5
  },

  card: {
    backgroundColor: 'white',
    padding: 25,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 3,
    marginBottom: 20
  },

  label: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
    letterSpacing: 1
  },

  code: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#000066',
    marginVertical: 10
  },

  qrBox: {
    backgroundColor: '#F1F5F9',
    padding: 15,
    borderRadius: 15
  },

  qr: {
    width: 180,
    height: 180
  },

  info: {
    textAlign: 'center',
    color: '#555',
    marginBottom: 30
  },

  button: {
    backgroundColor: '#000066',
    padding: 18,
    borderRadius: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10
  },

  btnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16
  }
});