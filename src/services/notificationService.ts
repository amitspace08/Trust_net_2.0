import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import { getMutualConnection } from "./trustService";
import { getUser } from "./userService";
/*
notifications

receiverUID
senderUID
title
message
type
createdAt
read
*/

// =======================================
// Send Notification
// =======================================

export async function sendNotification(
  receiverUID: string,
  senderUID: string,
  title: string,
  message: string,
  type: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    await addDoc(collection(db, "notifications"), {
      receiverUID,
      senderUID,
      receiver: receiverUID, // backward compatibility
      sender: senderUID, // backward compatibility
      title,
      message,
      type,
      createdAt: serverTimestamp(),
      timestamp: serverTimestamp(), // backward compatibility
      read: false,
      ...metadata,
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
}

/** Browser-compatible foreground notification. Persistent delivery when the
 * browser is closed requires an FCM web-push service worker and VAPID key. */
export async function showBrowserNotification(title: string, options: NotificationOptions) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission === "granted") new Notification(title, options);
}

// Backward compatibility export for guardianService and frontend UI
export async function sendSOSNotification(sender: string, receiver: string) {
  await sendNotification(receiver, sender, "SOS Alert", `${sender} has triggered an SOS`, "SOS");
}

// =======================================
// Notify Layer 1 Contacts
// =======================================

export async function notifyLayer1(sessionId: string) {
  try {
    const snap = await getDoc(doc(db, "sos_sessions", sessionId));

    if (!snap.exists()) return;

    const data = snap.data();
    
    // Fetch distressed user's display name
    const userRef = doc(db, "users", data.triggeredBy);
    const userSnap = await getDoc(userRef);
    const userName = userSnap.exists() ? (userSnap.data().name || userSnap.data().displayName) : "Someone";

    const contacts = data.layer1Alerted || [];

    for (const uid of contacts) {
      await sendNotification(
        uid,
        data.triggeredBy,
        "SOS Alert",
        `${userName} has triggered an SOS — they need help now`,
        "SOS",
        { sessionId, deepLink: `/sos-receiver?sessionId=${sessionId}&role=layer1` },
      );
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// =======================================
// Notify Layer 1 Follow-up
// =======================================

export async function notifyLayer1FollowUp(sessionId: string) {
  try {
    const snap = await getDoc(doc(db, "sos_sessions", sessionId));
    if (!snap.exists()) return;
    const data = snap.data();
    
    // Check if the session is still active and no one has acknowledged it
    if (data.status !== "active" || data.layer1Acknowledged) return;

    const user = await getUser(data.triggeredBy);
    const displayName = user?.displayName || user?.name || "Someone";
    const contacts = data.layer1Alerted || [];

    for (const uid of contacts) {
      await sendNotification(
        uid,
        data.triggeredBy,
        "SOS Follow-up Alert",
        `${displayName} still needs help — please respond now.`,
        "SOS_FOLLOWUP",
        { sessionId, deepLink: `/sos-receiver?sessionId=${sessionId}&role=layer1` },
      );
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// =======================================
// Notify Guardian (Layer 3)
// =======================================

export async function notifyGuardian(sessionId: string, guardian: { uid: string; distance: number }, distressedUID: string) {
  try {
    const distanceMsg = `${Math.round(guardian.distance)}m`;
    const message = `Emergency nearby — someone needs help ${distanceMsg} from you. Can you respond?`;
    await sendNotification(guardian.uid, distressedUID, "Guardian Angel Alert", message, "LAYER3_SOS", {
      sessionId,
      deepLink: `/sos-receiver?sessionId=${sessionId}&role=layer3`,
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// =======================================
// Notify Responders
// =======================================

export async function notifyResponders(sessionId: string) {
  try {
    const responders = await getDocs(collection(db, "sos_sessions", sessionId, "responders"));

    const sos = await getDoc(doc(db, "sos_sessions", sessionId));

    if (!sos.exists()) return;

    const owner = sos.data().triggeredBy;

    await Promise.all(
      responders.docs.map((r) =>
        sendNotification(
          r.id,
          owner,
          "SOS ended",
          "The person marked themselves safe. Thank you for responding.",
          "END_SOS",
          {
            sessionId,
            deepLink: "/",
          },
        ),
      ),
    );
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// =======================================
// Get Notifications
// =======================================

export async function getNotifications(uid: string) {
  const q = query(collection(db, "notifications"), where("receiverUID", "==", uid));

  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));
}

// =======================================
// Notify Layer 2 Candidates
// =======================================

export async function notifyLayer2(
  sessionId: string,
  candidateUIDs: string[],
  distressedUID: string,
) {
  try {
    for (const uid of candidateUIDs) {
      const mutual = await getMutualConnection(distressedUID, uid);

      const message = mutual
        ? `A friend of ${mutual.name || mutual.displayName || "Someone"} needs help near you. Can you assist?`
        : "A nearby user needs emergency assistance.";

      await sendNotification(uid, distressedUID, "Layer 2 SOS Alert", message, "LAYER2_SOS", {
        sessionId,
        deepLink: `/sos-receiver?sessionId=${sessionId}&role=layer2`,
      });
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// =======================================
// Notify Next Layer 2 Candidate
// =======================================

export async function notifyNextCandidate(
  sessionId: string,
  nextCandidateUID: string,
  distressedUID: string,
) {
  try {
    const mutual = await getMutualConnection(distressedUID, nextCandidateUID);

    const message = mutual
      ? `A friend of ${mutual.name || mutual.displayName || "Someone"} needs help near you. Can you assist?`
      : "Emergency assistance is still required nearby.";

    await sendNotification(
      nextCandidateUID,
      distressedUID,
      "Layer 2 SOS Retry",
      message,
      "LAYER2_RETRY",
      { sessionId, deepLink: `/sos-receiver?sessionId=${sessionId}&role=layer2` },
    );
  } catch (err) {
    console.error(err);
    throw err;
  }
}
