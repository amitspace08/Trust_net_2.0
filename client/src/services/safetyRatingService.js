import { db } from "../firebase/firebase";
import { collection, addDoc, getDocs, serverTimestamp, query, where } from "firebase/firestore";
import { getDistance } from "./guardianService";

// Helper to compute gridCell key
export const getGridCell = (lat, lng) => {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
};

// Submit Rating
export const submitRating = async (uid, lat, lng, score, tags) => {
  if (score < 1 || score > 10) {
    throw new Error("Score must be between 1 and 10");
  }

  const gridCell = getGridCell(lat, lng);
  const now = new Date();

  // Abuses Prevention 1: 2-hour rating cooldown per gridCell
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const qCooldown = query(
    collection(db, "safety_ratings"),
    where("uid", "==", uid),
    where("gridCell", "==", gridCell),
  );
  const cooldownSnap = await getDocs(qCooldown);

  for (const doc of cooldownSnap.docs) {
    const data = doc.data();
    const t = data.timestamp;
    if (t && t.toDate() > twoHoursAgo) {
      throw new Error("You can only submit one rating for this area every 2 hours.");
    }
  }

  // Abuse Prevention 2: Cap each user's contribution to any gridCell at 3 ratings per 24 hours
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let dailyCount = 0;
  for (const doc of cooldownSnap.docs) {
    const data = doc.data();
    const t = data.timestamp;
    if (t && t.toDate() > twentyFourHoursAgo) {
      dailyCount++;
    }
  }

  if (dailyCount >= 3) {
    throw new Error("You have reached the limit of 3 ratings per 24 hours for this area.");
  }

  // Write to Firestore
  const docRef = await addDoc(collection(db, "safety_ratings"), {
    uid,
    latitude: lat,
    longitude: lng,
    score,
    tags,
    gridCell,
    timestamp: serverTimestamp(),
  });

  return docRef.id;
};

// Get Area Score (Average rating within 150m)
export const getAreaScore = async (lat, lng) => {
  // To avoid fetching everything, we can query ratings in the same general grid area, or just fetch all and filter by distance.
  // For Jaipur demo, we fetch all ratings and calculate distance in-memory (highly accurate for 150m).
  const snap = await getDocs(collection(db, "safety_ratings"));

  let totalScore = 0;
  let count = 0;
  const tagCounts = {};

  snap.forEach((doc) => {
    const data = doc.data();
    const dist = getDistance(lat, lng, data.latitude, data.longitude);
    if (dist <= 150) {
      totalScore += data.score;
      count++;

      // Count tags
      const tags = data.tags || [];
      tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    }
  });

  if (count < 3) {
    return null; // Return null if fewer than 3 ratings exist
  }

  const average = Number((totalScore / count).toFixed(1));

  // Find top 2 tags
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
    .slice(0, 2);

  return {
    score: average,
    ratingCount: count,
    topTags,
  };
};
