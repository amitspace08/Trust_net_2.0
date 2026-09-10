import { createUser } from "./userService";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
} from "firebase/auth";

import { auth } from "../firebase/firebase";

// ======================================
// Sign Up
// ======================================

export const signup = async (name, email, password) => {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(credential.user, {
      displayName: name,
    });

    await createUser(credential.user.uid, {
      displayName: credential.user.displayName || name || "",
      email: credential.user.email || email || "",
      photoURL: credential.user.photoURL || "",
    });

    return {
      success: true,
      user: credential.user,
    };
  } catch (error) {
    console.error(error);

    return {
      success: false,
      message: error.message,
    };
  }
};

// ======================================
// Login
// ======================================

export const login = async (email, password) => {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);

    return {
      success: true,
      user: credential.user,
    };
  } catch (error) {
    console.error(error);

    return {
      success: false,
      message: error.message,
    };
  }
};

// ======================================
// Current User
// ======================================

export const getCurrentUser = () => auth.currentUser;

// ======================================
// Auth State Listener
// ======================================

export const authListener = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// ======================================
// Logout
// ======================================

export const logout = async () => {
  await signOut(auth);
};
