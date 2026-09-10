import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBc9ngpaHNcMJy7A8ajNIvbYtEPyt9YhfI",
  authDomain: "trustnet-c6a94.firebaseapp.com",
  projectId: "trustnet-c6a94",
  storageBucket: "trustnet-c6a94.firebasestorage.app",
  messagingSenderId: "947759878994",
  appId: "1:947759878994:web:899dac1eb729557243e08b",
};

const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
