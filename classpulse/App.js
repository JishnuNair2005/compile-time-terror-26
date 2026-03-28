import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Import your screens
import HomeScreen from './src/screens/HomeScreen';
import AdminScreen from './src/screens/admin';
import UserScreen from './src/screens/user';
import LoginScreen from './src/screens/LoginScreen';
import CreateRoomScreen from './src/screens/CreateRoomScreen';
import SessionCreatedScreen from './src/screens/SessionCreatedScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Admin" component={AdminScreen} />
        <Stack.Screen name="User" component={UserScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="CreateRoom" component={CreateRoomScreen} />
        <Stack.Screen name="SessionCreated" component={SessionCreatedScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}