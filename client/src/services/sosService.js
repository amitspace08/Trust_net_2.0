import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  GeoPoint,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getLayer1Contacts } from "./trustService";
import { db } from "../firebase/firebase";
import { getLayer2Candidates, rankLayer2Candidates } from "./trustService";
import {
  notifyLayer1,
  notifyLayer2,
  notifyNextCandidate,
  notifyResponders,
} from "./notificationService";
import { clearLiveSOSLocation, updateLiveSOSLocation } from "./locationService";
import { notifyLayer1FollowUp } from "./notificationService";
import { clearGuardianTimer } from "./guardianService";

// Map to track pending timers for each SOS session
const sosTimers = new Map();

export function clearSOSTimers(sessionId) {
  const timers = sosTimers.get(sessionId);
  if (timers) {
    if (timers.followUpTimeout) clearTimeout(timers.followUpTimeout);
    if (timers.l2Timeout) clearTimeout(timers.l2Timeout);
    if (timers.l3Timeout) clearTimeout(timers.l3Timeout);
    if (timers.locationInterval) clearInterval(timers.locationInterval);
    sosTimers.delete(sessionId);
  }
  clearGuardianTimer(sessionId);
}

/** Start broadcasting live SOS location every 5 seconds */
export function startSOSLocationUpdates(sessionId, uid) {
  // Ensure any existing interval is cleared first
  stopSOSLocationUpdates(sessionId);
  const interval = setInterval(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          updateLiveSOSLocation(sessionId, uid, pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.error("SOS Location update failed:", err);
        },
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    }
  }, 5_000);
  const timers = sosTimers.get(sessionId) || {};
  timers.locationInterval = interval;
  sosTimers.set(sessionId, timers);
}

/** Stop the live location broadcast for a session */
export function stopSOSLocationUpdates(sessionId) {
  const timers = sosTimers.get(sessionId);
  if (timers?.locationInterval) {
    clearInterval(timers.locationInterval);
    timers.locationInterval = undefined;
  }
  sosTimers.set(sessionId, timers || {});
}
/*
Collection

sos_sessions

Fields

sessionId
triggeredBy
status
layerActive
startTime
endTime
layer1Alerted
layer1Acknowledged
*/

// ==============================
// Trigger SOS
// ==============================

export async function triggerSOS(uid, arg2, arg3) {
  try {
    let lat;
    let lng;
    let layer1Contacts = [];

    if (typeof arg2 === "number" && typeof arg3 === "number") {
      // Called as: triggerSOS(uid, lat, lng)
      lat = arg2;
      lng = arg3;
      // Fetch layer 1 contacts automatically
      const l1Docs = await getLayer1Contacts(uid);
      layer1Contacts = l1Docs.map((c) => (c.userA === uid ? c.userB : c.userA));
    } else if (Array.isArray(arg2)) {
      // Called as: triggerSOS(uid, layer1Contacts)
      layer1Contacts = arg2;
      // Retrieve location from user_locations if possible
      try {
        const userLocRef = doc(db, "user_locations", uid);
        const userLocSnap = await getDoc(userLocRef);
        if (userLocSnap.exists()) {
          const locData = userLocSnap.data();
          if (locData.geopoint) {
            lat = locData.geopoint.latitude;
            lng = locData.geopoint.longitude;
          } else if (typeof locData.latitude === "number") {
            lat = locData.latitude;
            lng = locData.longitude;
          }
        }
      } catch (e) {
        console.error("Could not fetch user location for SOS session:", e);
      }
    }

    const docRef = await addDoc(collection(db, "sos_sessions"), {
      triggeredBy: uid,
      status: "active",
      active: true, // backward compatibility
      layerActive: 1,
      startTime: serverTimestamp(),
      timestamp: serverTimestamp(), // backward compatibility
      endTime: null,
      layer1Alerted: layer1Contacts,
      layer1Acknowledged: null,
      latitude: lat ?? 28.6139,
      longitude: lng ?? 77.209,
      geopoint: lat !== undefined && lng !== undefined ? new GeoPoint(lat, lng) : null,
    });

    await updateDoc(doc(db, "sos_sessions", docRef.id), {
      sessionId: docRef.id,
    });

    await notifyLayer1(docRef.id);

    // Follow‑up notification at 45 seconds
    const followUpTimeout = setTimeout(() => notifyLayer1FollowUp(docRef.id), 45_000);
    // Local development fallback for Layer 2 & 3 escalation 
    // (since Cloud Functions may not be running)
    const l2Timeout = setTimeout(() => triggerLayer2(docRef.id, { lat, lng }), 60_000);
    const l3Timeout = setTimeout(() => triggerLayer3(docRef.id), 90_000);

    sosTimers.set(docRef.id, {
      followUpTimeout,
      l2Timeout,
      l3Timeout,
    });

    return docRef.id;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// ==============================
// Cancel SOS
// ==============================

export async function cancelSOS(sessionId) {
  try {
    await updateDoc(doc(db, "sos_sessions", sessionId), {
      status: "cancelled",
      active: false, // backward compatibility
      endTime: serverTimestamp(),
    });
    try {
      await deleteDoc(doc(db, "live_locations", sessionId));
    } catch (e) {
      console.error("Error clearing live SOS location:", e);
    }
    try {
      await notifyResponders(sessionId);
    } catch (e) {
      console.error("Error notifying responders:", e);
    }
    try {
      await deleteLayer2Alerts(sessionId);
    } catch (e) {
      console.error("Error deleting layer 2 alerts:", e);
    }
    clearSOSTimers(sessionId);
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// ==============================
// Acknowledge SOS
// ==============================

export async function acknowledgeSOS(sessionId, responderUID) {
  try {
    const userSnap = await getDoc(doc(db, "users", responderUID));
    const responderName = userSnap.exists() ? userSnap.data().name || userSnap.data().displayName : "A Responder";

    await updateDoc(
      doc(db, "sos_sessions", sessionId),
      {
        responderUID: responderUID,
        responderName: responderName,
        layer1Acknowledged: responderUID,
        status: "active",
      },
    );
    clearSOSTimers(sessionId);
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// ==============================
// End SOS
// ==============================

export async function endSOS(sessionId) {
  try {
    await updateDoc(
      doc(db, "sos_sessions", sessionId),

      {
        status: "resolved",
        active: false, // backward compatibility

        endTime: serverTimestamp(),
      },
    );
    try {
      await clearLiveSOSLocation(sessionId);
    } catch (e) {
      console.error("Error clearing live SOS location:", e);
    }
    try {
      await notifyResponders(sessionId);
    } catch (e) {
      console.error("Error notifying responders:", e);
    }
    try {
      await deleteLayer2Alerts(sessionId);
    } catch (e) {
      console.error("Error deleting layer 2 alerts:", e);
    }
    clearSOSTimers(sessionId);
  } catch (err) {
    console.error(err);

    throw err;
  }
}

// ==============================
// Archive SOS
// ==============================

export async function archiveSOS(sessionId) {
  const source = doc(
    db,

    "sos_sessions",

    sessionId,
  );

  const snap = await getDoc(source);

  if (!snap.exists()) return;

  await setDoc(
    doc(db, "sos_history", sessionId),

    snap.data(),
  );

  await deleteDoc(source);
}

// =======================================
// Add Responder
// =======================================

export async function addResponder(sessionId, uid, name, lat, lng) {
  try {
    await setDoc(doc(db, "sos_sessions", sessionId, "responders", uid), {
      uid,
      name,
      respondedAt: serverTimestamp(),
      currentLocation: new GeoPoint(lat, lng),
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// =======================================
// Update Responder Location
// =======================================

export async function updateResponderLocation(sessionId, uid, lat, lng) {
  try {
    await updateDoc(doc(db, "sos_sessions", sessionId, "responders", uid), {
      currentLocation: new GeoPoint(lat, lng),
      respondedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// =======================================
// Listen SOS Session
// =======================================

export function listenSOS(sessionId, callback) {
  return onSnapshot(doc(db, "sos_sessions", sessionId), (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data());
    }
  });
}

// =======================================
// Get SOS Session
// =======================================

export async function getSOSSession(sessionId) {
  try {
    const snap = await getDoc(doc(db, "sos_sessions", sessionId));

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

// =======================================
// Trigger Layer 2
// =======================================
export async function triggerLayer2(sessionId, distressedLocation) {
  try {
    console.log("Layer 1 timeout — ready for Layer 2 escalation");
    const session = await getSOSSession(sessionId);

    if (!session) {
      throw new Error("SOS session not found.");
    }

    // Check if Layer 1 acknowledged or if the session is no longer active
    if (session.status !== "active" || session.layer1Acknowledged) {
      return [];
    }

    const candidates = await getLayer2Candidates(session.triggeredBy);

    const ranked = await rankLayer2Candidates(candidates, distressedLocation);

    await updateDoc(doc(db, "sos_sessions", sessionId), {
      layerActive: 2,
      layer1Timeout: serverTimestamp(),
      layer2Alerted: ranked.map((c) => c.uid),
      layer2Acknowledged: null,
      layer2TriggerTime: serverTimestamp(),
      declinedCandidates: [],
    });

    await Promise.all(
      ranked.map((candidate, rank) =>
        setDoc(doc(db, "active_layer2_alerts", `${sessionId}_${candidate.uid}`), {
          sessionId,
          receiverUID: candidate.uid,
          rank,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          createdAt: serverTimestamp(),
        }),
      ),
    );
    await notifyLayer2(
      sessionId,
      ranked.map((candidate) => candidate.uid),
      session.triggeredBy,
    );

    // Start 120-second timeout for Layer 2 is now handled by Cloud Functions
    // startLayer2Timeout(sessionId);

    return ranked;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// =======================================
// Acknowledge Layer 2
// =======================================

export async function acknowledgeLayer2(sessionId, responderUID) {
  try {
    const userSnap = await getDoc(doc(db, "users", responderUID));
    const responderName = userSnap.exists() ? userSnap.data().name || userSnap.data().displayName : "A Responder";

    await updateDoc(doc(db, "sos_sessions", sessionId), {
      responderUID: responderUID,
      responderName: responderName,
      layer2Acknowledged: responderUID,
      status: "active",
    });
    clearSOSTimers(sessionId);
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// =======================================
// Decline Layer 2
// =======================================

export async function declineLayer2(sessionId, responderUID) {
  try {
    const ref = doc(db, "sos_sessions", sessionId);

    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    const data = snap.data();

    const declined = data.declinedCandidates || [];

    if (!declined.includes(responderUID)) {
      declined.push(responderUID);
    }

    await updateDoc(ref, {
      declinedCandidates: declined,
    });

    const ranked = data.layer2Alerted || [];
    const next = ranked.find((uid) => !declined.includes(uid));
    if (next) await notifyNextCandidate(sessionId, next, data.triggeredBy);
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// =======================================
// Start Layer 2 Timeout
// =======================================

export function startLayer2Timeout(sessionId) {
  // Handled by Firebase Cloud Functions Server-Side.
}
// =======================================
// Delete Layer 2 Alerts
// =======================================

export async function deleteLayer2Alerts(sessionId) {
  const q = query(collection(db, "active_layer2_alerts"), where("sessionId", "==", sessionId));

  const snapshot = await getDocs(q);

  for (const document of snapshot.docs) {
    await deleteDoc(document.ref);
  }
}

// Backward compatibility for Map UI
export function subscribeToSOS(callback) {
  const q = query(collection(db, "sos_sessions"), where("active", "==", true));

  return onSnapshot(q, (snapshot) => {
    const sessions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    callback(sessions);
  });
}
