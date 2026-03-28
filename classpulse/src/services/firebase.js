// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCGFWvgfnWbPzknsOnm9-B3V9SevlVyxFo",
  authDomain: "colohacks26.firebaseapp.com",
  projectId: "colohacks26",
  storageBucket: "colohacks26.firebasestorage.app",
  messagingSenderId: "816913281547",
  appId: "1:816913281547:web:b68c88c5d4f39362c98d0e",
  measurementId: "G-DPZ763BE05"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
export const db = getFirestore(app);

export default app