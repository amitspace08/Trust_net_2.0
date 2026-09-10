import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";

import { db } from "../firebase/firebase";

// ======================================
// Get User Profile
// ======================================

export async function getUser(uid) {
  try {
    const ref = doc(db, "users", uid);

    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return null;
    }

    return {
      id: snap.id,
      ...snap.data(),
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// ======================================
// Create User Profile
// ======================================

export async function createUser(uid, data) {
  try {
    await setDoc(doc(db, "users", uid), {
      uid,
      displayName: data.displayName,
      email_id: data.email,
      phone_no: data.phone || "",
      profile_photo: data.photoURL || "",

      trustScore: 100,
      verification_status: true,

      isGuardianAngel: false,
      guardianAvailable: false,
      guardianVerified: false,
      guardianRating: 0,
      guardianResponseCount: 0,

      sharingLocation: true,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// ======================================
// Update Profile
// ======================================

export async function updateUser(uid, updates) {
  try {
    await updateDoc(doc(db, "users", uid), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// ======================================
// Update Display Name
// ======================================

export async function updateDisplayName(uid, displayName) {
  await updateUser(uid, {
    displayName,
  });
}

// ======================================
// Update Phone Number
// ======================================

export async function updatePhoneNumber(uid, phone) {
  await updateUser(uid, {
    phone_no: phone,
  });
}

// ======================================
// Update Profile Photo
// ======================================

export async function updateProfilePhoto(uid, photoURL) {
  await updateUser(uid, {
    profile_photo: photoURL,
  });
}

// ======================================
// Toggle Location Sharing
// ======================================

export async function updateLocationSharing(uid, enabled) {
  await updateUser(uid, {
    sharingLocation: enabled,
  });
}

// ======================================
// Update Trust Score
// ======================================

export async function updateTrustScore(uid, score) {
  await updateUser(uid, {
    trustScore: score,
  });
}
