import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../lib/auth";

import { getLayer2Candidates as getLayer2FromService } from "../services/trustService";

// Helper for Haversine distance
function formatDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  if (d < 1) {
    return `${Math.round(d * 1000)}m`;
  }
  return `${d.toFixed(1)}km`;
}

export function useLayer1Contacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    if (!user) return;

    const qAccepted = query(
      collection(db, "trust_relationships"),
      where("status", "==", "accepted"),
    );

    const unsubscribe = onSnapshot(qAccepted, async (snapshot) => {
      try {
        const list = [];
        let browserLat = 28.6139;
        let browserLng = 77.209;
        try {
          const rawLoc = localStorage.getItem("trustnet_browser_location");
          if (rawLoc) {
            const parsed = JSON.parse(rawLoc);
            browserLat = parsed.lat;
            browserLng = parsed.lng;
          }
        } catch {}

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          if (data.userA === user.id || data.userB === user.id) {
            const contactUid = data.userA === user.id ? data.userB : data.userA;
            const userRef = doc(db, "users", contactUid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const uData = userSnap.data();
              const locRef = doc(db, "user_locations", contactUid);
              const locSnap = await getDoc(locRef);
              const locData = locSnap.exists() ? locSnap.data() : null;

              const cLat = locData?.geopoint?.latitude ?? locData?.latitude ?? 28.6139;
              const cLng = locData?.geopoint?.longitude ?? locData?.longitude ?? 77.209;
              const distStr =
                locData?.sharingEnabled !== false
                  ? formatDistance(browserLat, browserLng, cLat, cLng)
                  : "Unknown";

              list.push({
                id: contactUid,
                relationshipId: docSnap.id,
                name: uData.name || uData.displayName || "Contact",
                phone: uData.phone || uData.phone_no || "",
                relation: data.relation || "Friend",
                avatar:
                  uData.avatar ||
                  uData.profile_photo ||
                  "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
                online: uData.online ?? true,
                status: data.inactive ? "Inactive" : "Active",
                at: data.createdAt?.seconds ? data.createdAt.seconds * 1000 : Date.now(),
                shareLocation: locData ? locData.sharingEnabled !== false : true,
                lastUpdated: locData?.timestamp?.toDate
                  ? locData.timestamp.toDate().toLocaleTimeString()
                  : "Just now",
                distance: distStr,
                latitude: cLat,
                longitude: cLng,
              });
            }
          }
        }
        setContacts(list);
      } catch (err) {
        console.error("Error subscribing to accepted contacts:", err);
      }
    });

    return () => unsubscribe();
  }, [user]);

  return contacts;
}

export function useLayer2Contacts() {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState([]);

  useEffect(() => {
    if (!user) return;
    getLayer2FromService(user.id)
      .then(async (list) => {
        const formatted = [];
        for (const item of list) {
          const uSnap = await getDoc(doc(db, "users", item.uid));
          if (uSnap.exists()) {
            const uData = uSnap.data();
            formatted.push({
              id: item.uid,
              name: uData.name || uData.displayName || "User",
              phone: uData.phone || uData.phone_no || "",
              relation: "Friend of " + item.mutualConnectionName,
              avatar:
                uData.avatar ||
                uData.profile_photo ||
                "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde",
              online: uData.online ?? false,
              distance: "1.5km", // In a real app we'd calculate from their location doc
              mutualContact: item.mutualConnectionName,
            });
          }
        }
        setCandidates(formatted);
      })
      .catch(console.error);
  }, [user]);

  return candidates;
}
