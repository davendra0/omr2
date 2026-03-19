import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

console.log("Firebase Config (masked):", {
  ...firebaseConfig,
  apiKey: firebaseConfig.apiKey ? firebaseConfig.apiKey.substring(0, 5) + "..." : "MISSING"
});

const app = initializeApp(firebaseConfig);
// Use named database if provided, otherwise fallback to (default)
const databaseId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "" 
  ? firebaseConfig.firestoreDatabaseId 
  : '(default)';

console.log("Firestore Database ID:", databaseId);
export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Login failed:", error);
    throw error;
  }
};

export const logout = async () => {
  localStorage.removeItem('admin_passcode');
  await signOut(auth);
};
