import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

export default function SessionCreatedScreen({ route, navigation }) {

  const { sessionData } = route.params;

  return (
    <View style={styles.container}>

      <Text style={styles.title}>Session Created</Text>

      {/* CODE */}
      <Text style={styles.code}>{sessionData.code}</Text>

      {/* QR */}
      <View style={styles.qrBox}>
        <QRCode value={sessionData.code} size={180} />
      </View>

      <Text style={styles.sub}>
        Students can join using this code
      </Text>

      {/* START BUTTON */}
      <TouchableOpacity 
        style={styles.button}
        onPress={() => navigation.navigate('Admin')}
      >
        <Text style={styles.btnText}>Start Session</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FB'
  },

  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20
  },

  code: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#000066',
    marginBottom: 20
  },

  qrBox: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20
  },

  sub: {
    color: '#555',
    marginBottom: 20
  },

  button: {
    backgroundColor: '#22C55E',
    padding: 15,
    borderRadius: 10
  },

  btnText: {
    color: 'white',
    fontWeight: 'bold'
  }
});