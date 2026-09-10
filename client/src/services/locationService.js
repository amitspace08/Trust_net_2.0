import {
  collection,
  deleteDoc,
  doc,
  GeoPoint,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

/**
 * Collection
 *
 * user_locations
 *
 * uid
 * geopoint
 * timestamp
 * sharingEnabled
 * available
 */

// ===============================
// Update My Location
// ===============================

export async function updateMyLocation(uid, lat, lng) {
  try {
    await setDoc(
      doc(db, "user_locations", uid),
      {
        uid: uid,
        geopoint: new GeoPoint(lat, lng),
        latitude: lat, // compatibility field
        longitude: lng, // compatibility field
        timestamp: serverTimestamp(),
        sharingEnabled: true,
        available: true,
      },
      { merge: true },
    );
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// ===============================
// Stop Sharing
// ===============================

export async function stopSharing(uid) {
  try {
    await setDoc(
      doc(db, "user_locations", uid),
      {
        sharingEnabled: false,
        available: false,
        geopoint: null,
        latitude: null,
        longitude: null,
        timestamp: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err) {
    console.error(err);
    throw err;
  }
}

/**
 * SOS locations are deliberately isolated from normal location sharing.  This lets
 * responders subscribe to a short-lived emergency feed without treating a user's
 * everyday location document as an SOS feed.
 */
export async function updateLiveSOSLocation(sessionId, uid, lat, lng) {
  await setDoc(
    doc(db, "live_locations", sessionId),
    {
      sessionId,
      uid,
      geopoint: new GeoPoint(lat, lng),
      latitude: lat,
      longitude: lng,
      timestamp: serverTimestamp(),
    },
    { merge: true },
  );
}

export function subscribeToLiveSOSLocation(sessionId, callback) {
  return onSnapshot(doc(db, "live_locations", sessionId), (snapshot) => {
    callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
  });
}

export async function clearLiveSOSLocation(sessionId) {
  await deleteDoc(doc(db, "live_locations", sessionId));
}

// ===============================
// Fetch Contact Locations
// ===============================

export async function getContactLocations(uidList) {
  try {
    if (uidList.length === 0) return [];

    const q = query(collection(db, "user_locations"), where("uid", "in", uidList));

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (err) {
    console.error(err);
    throw err;
  }
}
