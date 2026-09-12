import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyComlFUf2tJzQstUVzJzJYb401uPvwBrdc",
  authDomain: "trustnet-1ec23.firebaseapp.com",
  projectId: "trustnet-1ec23",
  storageBucket: "trustnet-1ec23.firebasestorage.app",
  messagingSenderId: "185380240068",
  appId: "1:185380240068:web:c430b881a177dd764aa791",
  measurementId: "G-D54WLN33GP",
};

const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
