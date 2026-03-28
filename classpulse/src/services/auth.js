import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
// 1. Import AsyncStorage for React Native
import AsyncStorage from "@react-native-async-storage/async-storage"; 

export const loginTeacher = async (email, password) => {
    try {
        const res = await signInWithEmailAndPassword(auth, email, password);
        const user = res.user;

        // Fetch teacher data from Firestore
        const docRef = doc(db, "teachers", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const teacherData = docSnap.data();

            // 2. Use AsyncStorage instead of localStorage
            // 3. Add 'await' because mobile storage is asynchronous
            await AsyncStorage.setItem("teacherId", user.uid);
            await AsyncStorage.setItem("teacherName", teacherData.name);

            return true;
        } else {
            alert("Teacher data not found in database");
            return false;
        }

    } catch (err) {
        console.error("Login Error:", err);
        alert("Invalid credentials or network error");
        return false;
    }
};