import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

export const loginTeacher = async (email, password) => {
    try {
        const res = await signInWithEmailAndPassword(auth, email, password);

        const user = res.user;

        // fetch teacher data
        const docRef = doc(db, "teachers", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const teacherData = docSnap.data();

            localStorage.setItem("teacherId", user.uid);
            localStorage.setItem("teacherName", teacherData.name);

            return true;
        } else {
            alert("Teacher data not found");
            return false;
        }

    } catch (err) {
        alert("Invalid credentials");
        return false;
    }
};