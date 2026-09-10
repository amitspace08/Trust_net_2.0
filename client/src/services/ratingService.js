import {
  addDoc,
  collection,
  GeoPoint,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

// ======================================
// Calculate Grid Cell
// ======================================

function getGridCell(latitude, longitude) {
  const latGrid = Math.floor(latitude * 100);
  const lonGrid = Math.floor(longitude * 100);

  return `${latGrid}_${lonGrid}`;
}

// ======================================
// Haversine Distance
// ======================================

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;

  const toRadians = (x) => (x * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);

  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ======================================
// Submit Rating
// ======================================

export async function submitRating(uid, latitude, longitude, score, tags) {
  const cell = getGridCell(latitude, longitude);

  const q = query(
    collection(db, "safety_ratings"),
    where("uid", "==", uid),
    where("gridCell", "==", cell),
  );

  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    throw new Error("Already rated recently.");
  }

  await addDoc(collection(db, "safety_ratings"), {
    uid,

    geopoint: new GeoPoint(latitude, longitude),

    score,

    tags,

    gridCell: cell,

    timestamp: serverTimestamp(),
  });
}

// ======================================
// Area Score
// ======================================

export async function getAreaScore(latitude, longitude) {
  const snapshot = await getDocs(collection(db, "safety_ratings"));

  let total = 0;

  let count = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();

    const distance = calculateDistance(
      latitude,

      longitude,

      data.geopoint.latitude,

      data.geopoint.longitude,
    );

    if (distance <= 150) {
      total += data.score;

      count++;
    }
  });

  if (count < 3) {
    return null;
  }

  return total / count;
}
