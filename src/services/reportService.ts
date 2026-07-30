import { db } from "../firebase/firebase";
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  query,
  where,
  Timestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import { getDistance } from "./guardianService";

export interface IncidentReport {
  id: string;
  uid: string;
  type: string;
  location: string;
  note: string;
  latitude: number;
  longitude: number;
  timestamp: Timestamp;
}

export const submitReport = async (
  uid: string,
  lat: number,
  lng: number,
  type: string,
  locationName: string,
  note: string
) => {
  const now = new Date();
  
  // Rate limiting: 5 reports per user per day to prevent spam
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const qCooldown = query(
    collection(db, "incident_reports"),
    where("uid", "==", uid)
  );
  
  const cooldownSnap = await getDocs(qCooldown);
  let dailyCount = 0;
  for (const doc of cooldownSnap.docs) {
    const data = doc.data();
    const t = data.timestamp as Timestamp;
    if (t && t.toDate() > twentyFourHoursAgo) {
      dailyCount++;
    }
  }

  if (dailyCount >= 5) {
    throw new Error("You have reached the daily limit for submitting reports.");
  }

  const docRef = await addDoc(collection(db, "incident_reports"), {
    uid,
    latitude: lat,
    longitude: lng,
    type,
    location: locationName,
    note,
    timestamp: serverTimestamp(),
  });

  return docRef.id;
};

// Fetch recent reports within a radius
export const getNearbyReports = async (lat: number, lng: number, radiusMeters = 500) => {
  const q = query(
    collection(db, "incident_reports"),
    orderBy("timestamp", "desc"),
    limit(50) // Fetch the latest 50 reports globally, then filter by distance locally
  );
  
  const snap = await getDocs(q);
  const reports: IncidentReport[] = [];

  snap.forEach((doc) => {
    const data = doc.data();
    // Only include reports from the last 24 hours
    const t = data.timestamp as Timestamp;
    if (t) {
      const isRecent = t.toDate() > new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dist = getDistance(lat, lng, data.latitude, data.longitude);
      
      if (isRecent && dist <= radiusMeters) {
        reports.push({
          id: doc.id,
          uid: data.uid,
          type: data.type,
          location: data.location,
          note: data.note,
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: t,
        });
      }
    }
  });

  return reports;
};
