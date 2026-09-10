import { db } from "../firebase/firebase";
import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { notifyGuardian } from "./notificationService";

// Haversine distance calculator
export function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // radius of Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Map to track active timeouts for Guardian Angels
const gaTimers = new Map();

export function startGuardianTimeout(sessionId, guardianUid, index) {
  // Clear any existing timer for this session
  if (gaTimers.has(sessionId)) {
    clearTimeout(gaTimers.get(sessionId));
  }

  const timeout = setTimeout(async () => {
    try {
      const sessionRef = doc(db, "sos_sessions", sessionId);
      const sessionSnap = await getDoc(sessionRef);
      if (!sessionSnap.exists()) return;

      const data = sessionSnap.data();
      // If session is not active or has been resolved/acknowledged, do nothing
      if (data.status !== "active" || data.layer3Acknowledged) return;

      const declined = data.layer3Declined || [];
      // If this guardian already declined, do nothing
      if (declined.includes(guardianUid)) return;

      // Automatically decline due to timeout
      const updatedDeclined = [...declined, guardianUid];
      const alerted = data.layer3Alerted || [];
      const remaining = alerted.filter((uid) => !updatedDeclined.includes(uid));

      await updateDoc(sessionRef, {
        layer3Declined: updatedDeclined,
        layer3Exhausted: remaining.length === 0,
      });

      // Notify the next GA if any are left
      if (remaining.length > 0) {
        const nextUid = remaining[0];
        // Calculate distance
        const lat = data.latitude;
        const lng = data.longitude;
        const locSnap = await getDoc(doc(db, "user_locations", nextUid));
        let distanceMeters = 0;
        if (locSnap.exists()) {
          const locData = locSnap.data();
          distanceMeters = Math.round(getDistance(lat, lng, locData.latitude, locData.longitude));
        }

        await notifyGuardian(
          sessionId,
          { uid: nextUid, distance: distanceMeters },
          data.triggeredBy,
        );

        // Start timeout for the next GA
        startGuardianTimeout(sessionId, nextUid, index + 1);
      }
    } catch (err) {
      console.error("Guardian Angel timeout error:", err);
    }
  }, 30_000);

  gaTimers.set(sessionId, timeout);
}

export function clearGuardianTimer(sessionId) {
  if (gaTimers.has(sessionId)) {
    clearTimeout(gaTimers.get(sessionId));
    gaTimers.delete(sessionId);
  }
}

// 1. Register as Guardian Angel
export const registerAsGuardianAngel = async (uid, name = "Guardian Angel") => {
  const userRef = doc(db, "users", uid);
  await setDoc(
    userRef,
    {
      uid,
      name,
      isGuardianAngel: true,
      guardianVerified: true,
      guardianAvailable: true,
      guardianRating: 5.0,
      guardianResponseCount: 0,
      guardianRegisteredAt: serverTimestamp(),
    },
    { merge: true },
  );

  // Also write to user_locations so they have a baseline location
  const locRef = doc(db, "user_locations", uid);
  const locSnap = await getDoc(locRef);
  if (!locSnap.exists()) {
    await setDoc(locRef, {
      uid,
      latitude: 26.9124, // default to Jaipur center coordinates
      longitude: 75.7873,
      sharingEnabled: true,
      timestamp: serverTimestamp(),
    });
  }
};

// 2. Set Availability
export const setGuardianAvailability = async (uid, available) => {
  await updateDoc(doc(db, "users", uid), {
    guardianAvailable: available,
  });
};

// 3. Find Guardian Angels
export const findGuardianAngels = async (lat, lng, maxRadius = 2000) => {
  const q = query(
    collection(db, "users"),
    where("isGuardianAngel", "==", true),
    where("guardianAvailable", "==", true),
  );

  const snap = await getDocs(q);
  const candidates = [];

  for (const userDoc of snap.docs) {
    const data = userDoc.data();
    // Fetch location of this GA
    const locSnap = await getDoc(doc(db, "user_locations", userDoc.id));
    if (locSnap.exists()) {
      const locData = locSnap.data();
      const dist = getDistance(lat, lng, locData.latitude, locData.longitude);
      candidates.push({
        uid: userDoc.id,
        name: data.name || "Guardian Angel",
        phone: data.phone || "",
        rating: data.guardianRating || 5.0,
        responseCount: data.guardianResponseCount || 0,
        latitude: locData.latitude,
        longitude: locData.longitude,
        distance: dist, // in meters
      });
    }
  }

  // Proximity sorting (closest first)
  candidates.sort((a, b) => a.distance - b.distance);

  // Filter based on incremental radius logic
  let radiusLimit = 500;
  let filtered = candidates.filter((c) => c.distance <= radiusLimit);

  if (filtered.length === 0 && radiusLimit < maxRadius) {
    radiusLimit = 750;
    filtered = candidates.filter((c) => c.distance <= radiusLimit);
  }
  if (filtered.length === 0 && radiusLimit < maxRadius) {
    radiusLimit = 1000;
    filtered = candidates.filter((c) => c.distance <= radiusLimit);
  }
  if (filtered.length === 0 && radiusLimit < maxRadius) {
    radiusLimit = maxRadius;
    filtered = candidates.filter((c) => c.distance <= radiusLimit);
  }

  return filtered;
};
// 4. Trigger Layer 3 Escalation
export const triggerLayer3 = async (sessionId) => {
  const sessionRef = doc(db, "sos_sessions", sessionId);
  const sessionSnap = await getDoc(sessionRef);
  if (!sessionSnap.exists()) return null;

  const sessionData = sessionSnap.data();
  const lat = sessionData.latitude;
  const lng = sessionData.longitude;

  // Find GAs within 2000m (2km)
  const gas = await findGuardianAngels(lat, lng, 2000);
  const gaUids = gas.map((g) => g.uid);

  await updateDoc(sessionRef, {
    layerActive: 3,
    layer3Alerted: gaUids,
    layer3TriggerTime: serverTimestamp(),
    layer3Exhausted: gaUids.length === 0, // if no GAs nearby, exhaust immediately
  });

  // Send notification to the first GA (since it's sequential notification)
  if (gas.length > 0) {
    const firstGa = gas[0];
    const distanceMeters = Math.round(firstGa.distance);
    await notifyGuardian(
      sessionId,
      { uid: firstGa.uid, distance: distanceMeters },
      sessionData.triggeredBy,
    );
    startGuardianTimeout(sessionId, firstGa.uid, 0);
  }

  return gas;
};

// 5. Acknowledge Layer 3 Alert
export const acknowledgeLayer3 = async (sessionId, guardianUID) => {
  const sessionRef = doc(db, "sos_sessions", sessionId);
  const userSnap = await getDoc(doc(db, "users", guardianUID));
  const name = userSnap.exists() ? userSnap.data().name : "Guardian Angel";

  await updateDoc(sessionRef, {
    layerActive: 3,
    responderName: name,
    responderUID: guardianUID,
    active: true, // keep session active, but set responder
    layer3Acknowledged: true,
  });

  clearGuardianTimer(sessionId);
};

// 6. Decline Layer 3 Alert
export const declineLayer3 = async (sessionId, guardianUID) => {
  const sessionRef = doc(db, "sos_sessions", sessionId);
  const sessionSnap = await getDoc(sessionRef);
  if (!sessionSnap.exists()) return;

  const data = sessionSnap.data();
  const declined = data.layer3Declined || [];
  const updatedDeclined = [...declined, guardianUID];

  const alerted = data.layer3Alerted || [];
  const remaining = alerted.filter((uid) => !updatedDeclined.includes(uid));

  await updateDoc(sessionRef, {
    layer3Declined: updatedDeclined,
    layer3Exhausted: remaining.length === 0,
  });

  clearGuardianTimer(sessionId);

  // If there are remaining GAs, notify the next one immediately (Sequential Alerting)
  if (remaining.length > 0) {
    const nextUid = remaining[0];
    const lat = data.latitude;
    const lng = data.longitude;
    const locSnap = await getDoc(doc(db, "user_locations", nextUid));
    let distanceMeters = 0;
    if (locSnap.exists()) {
      const locData = locSnap.data();
      distanceMeters = Math.round(getDistance(lat, lng, locData.latitude, locData.longitude));
    }

    await notifyGuardian(sessionId, { uid: nextUid, distance: distanceMeters }, data.triggeredBy);
    startGuardianTimeout(sessionId, nextUid, updatedDeclined.length);
  }
};

// 7. Update Guardian Rating
export const updateGuardianRating = async (guardianUID, newRating) => {
  const userRef = doc(db, "users", guardianUID);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return;

  const data = userSnap.data();
  const currentCount = data.guardianResponseCount || 0;
  const currentRating = data.guardianRating || 5.0;

  // Running average calculation
  const updatedCount = currentCount + 1;
  const updatedRating = (currentRating * currentCount + newRating) / updatedCount;

  await updateDoc(userRef, {
    guardianRating: Number(updatedRating.toFixed(2)),
    guardianResponseCount: updatedCount,
  });
};
