import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  GeoPoint,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import { getUser } from "./userService";

/**
 * Firestore Collection
 *
 * trust_relationships
 *
 * Fields
 * userA
 * userB
 * status
 * createdAt
 */

// =========================
// Send Trust Request
// =========================
export async function sendTrustRequest(fromUID: string, toUID: string) {
  try {
    if (fromUID === toUID) {
      throw new Error("Cannot send request to yourself.");
    }

    // Check if request already exists
    const q = query(
      collection(db, "trust_relationships"),
      where("userA", "==", fromUID),
      where("userB", "==", toUID),
    );

    const existing = await getDocs(q);

    if (!existing.empty) {
      throw new Error("Trust request already exists.");
    }

    const docRef = await addDoc(collection(db, "trust_relationships"), {
      userA: fromUID,
      userB: toUID,
      status: "pending",
      createdAt: serverTimestamp(),
    });

    try {
      const senderUser = await getUser(fromUID);
      const senderName = senderUser?.name || senderUser?.displayName || "Someone";
      await addDoc(collection(db, "notifications"), {
        receiverUID: toUID,
        senderUID: fromUID,
        receiver: toUID,
        sender: fromUID,
        title: "Trust Circle Request",
        message: `${senderName} sent you a trust request.`,
        type: "trust_request",
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp(),
        read: false,
        deepLink: "/circle",
      });
    } catch (nErr) {
      console.warn("Failed to send notification for trust request:", nErr);
    }

    return docRef.id;
  } catch (error) {
    console.error("sendTrustRequest:", error);
    throw error;
  }
}

// =========================
// Accept Request
// =========================
export async function acceptRequest(requestID: string) {
  try {
    const relRef = doc(db, "trust_relationships", requestID);
    const relSnap = await getDoc(relRef);
    if (!relSnap.exists()) {
      throw new Error("Relationship not found.");
    }
    const relData = relSnap.data();
    await updateDoc(relRef, {
      status: "accepted",
    });

    try {
      const acceptorUser = await getUser(relData.userB);
      const acceptorName = acceptorUser?.name || acceptorUser?.displayName || "Someone";
      await addDoc(collection(db, "notifications"), {
        receiverUID: relData.userA,
        senderUID: relData.userB,
        receiver: relData.userA,
        sender: relData.userB,
        title: "Trust Request Accepted",
        message: `${acceptorName} accepted your trust request.`,
        type: "trust_accept",
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp(),
        read: false,
        deepLink: "/circle",
      });
    } catch (nErr) {
      console.warn("Failed to send notification for trust accept:", nErr);
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// =========================
// Reject Request
// =========================
export async function rejectRequest(requestID: string) {
  try {
    await updateDoc(doc(db, "trust_relationships", requestID), {
      status: "rejected",
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// =========================
// Layer 1 Contacts
// =========================
export async function getLayer1Contacts(userUID: string) {
  try {
    const q = query(collection(db, "trust_relationships"), where("status", "==", "accepted"));

    const snapshot = await getDocs(q);

    const contacts = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
      }))
      .filter((item: any) => item.userA === userUID || item.userB === userUID);

    return contacts;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// =========================
// Search User By Phone
// =========================
export async function searchUserByPhone(phone: string) {
  try {
    const q = query(collection(db, "users"), where("phone_no", "==", phone));

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    return {
      id: snapshot.docs[0].id,
      ...(snapshot.docs[0].data() as any),
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// getUser is imported from userService

// =========================
// Layer 2 Candidates
// =========================

export async function getLayer2Candidates(uid: string) {
  try {
    const layer1 = await getLayer1Contacts(uid);

    const layer1UIDs = layer1.map((contact: any) =>
      contact.userA === uid ? contact.userB : contact.userA,
    );

    const candidateMap = new Map<
      string,
      {
        uid: string;
        mutualConnectionUID: string;
      }
    >();

    for (const layer1UID of layer1UIDs) {
      const contacts = await getLayer1Contacts(layer1UID);

      for (const contact of contacts as any[]) {
        const candidateUID = contact.userA === layer1UID ? contact.userB : contact.userA;

        if (candidateUID !== uid && !layer1UIDs.includes(candidateUID)) {
          if (!candidateMap.has(candidateUID)) {
            candidateMap.set(candidateUID, {
              uid: candidateUID,
              mutualConnectionUID: layer1UID,
            });
          }
        }
      }
    }

    return Array.from(candidateMap.values());
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// =========================
// Haversine Distance (meters)
// =========================

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000; // Earth's radius in meters

  const toRadians = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// =========================
// Rank Layer 2 Candidates
// =========================

// =========================
// Rank Layer 2 Candidates
// =========================

export async function rankLayer2Candidates(candidateUIDs: any[], distressedLocation: GeoPoint) {
  try {
    const ranked = [];

    for (const candidate of candidateUIDs) {
      const user = await getUser(candidate.uid);

      if (!user) continue;

      const locationSnap = await getDoc(doc(db, "user_locations", candidate.uid));

      if (!locationSnap.exists()) continue;

      const location = locationSnap.data();

      // Skip unavailable users
      if (!location.sharingEnabled) continue;

      const point = location.geopoint;

      const distance = calculateDistance(
        distressedLocation.latitude,
        distressedLocation.longitude,
        point.latitude,
        point.longitude,
      );

      ranked.push({
        uid: candidate.uid,
        name: user.displayName,
        phone: user.phone_no,
        distance,
        mutualConnectionUID: candidate.mutualConnectionUID,
      });
    }

    ranked.sort((a, b) => a.distance - b.distance);

    return ranked.slice(0, 10);
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// =========================
// Mutual Connection
// =========================

export async function getMutualConnection(userAUID: string, userBUID: string) {
  try {
    const layer2 = await getLayer2Candidates(userAUID);

    const match = layer2.find((candidate) => candidate.uid === userBUID);

    if (!match) return null;

    return await getUser(match.mutualConnectionUID);
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// ======================================
// Find Guardian Angels
// ======================================

export async function findGuardianAngels(location: GeoPoint, radiusMeters: number = 500) {
  try {
    const q = query(
      collection(db, "users"),
      where("isGuardianAngel", "==", true),
      where("guardianAvailable", "==", true),
    );

    const snapshot = await getDocs(q);

    const guardians = [];

    for (const document of snapshot.docs) {
      const user = document.data();

      const locationDoc = await getDoc(doc(db, "user_locations", document.id));

      if (!locationDoc.exists()) continue;

      const point = locationDoc.data().geopoint;

      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        point.latitude,
        point.longitude,
      );

      if (distance <= radiusMeters) {
        guardians.push({
          uid: document.id,

          distance,

          ...user,
        });
      }
    }

    guardians.sort((a, b) => a.distance - b.distance);

    if (guardians.length === 0 && radiusMeters < 1000) {
      return await findGuardianAngels(location, radiusMeters + 250);
    }

    return guardians;
  } catch (err) {
    console.error(err);

    throw err;
  }
}
