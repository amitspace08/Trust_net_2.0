import { useEffect } from "react";
import { useAuth } from "../lib/auth";
import { updateMyLocation, updateLiveSOSLocation } from "../services/locationService";

export function useLiveLocationTracker() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    if (!navigator.geolocation) return;

    let isSharing = true;
    let isBgLocationEnabled = true;
    let unsubUser = () => {};
    
    // Listen to real-time privacy settings
    import("firebase/firestore").then(({ doc, onSnapshot }) => {
      import("../firebase/firebase").then(({ db }) => {
         const userRef = doc(db, "users", String(user.id));
         unsubUser = onSnapshot(userRef, (docSnap) => {
           if (docSnap.exists()) {
             const data = docSnap.data();
             if (data.privacySettings) {
               if (data.privacySettings.liveSharing !== undefined) {
                 isSharing = data.privacySettings.liveSharing;
               }
               if (data.privacySettings.bgLocation !== undefined) {
                 isBgLocationEnabled = data.privacySettings.bgLocation;
               }
             }
           }
         });
      });
    });

    // Use watchPosition to continuously get the latest device location
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        if (!isSharing) return;
        if (!isBgLocationEnabled && document.hidden) return;
        
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          
          // Update normal Firestore and LocalStorage
          await updateMyLocation(user.id, lat, lng);
          localStorage.setItem(
            "trustnet_browser_location",
            JSON.stringify({ lat, lng }),
          );

          // If SOS is active, broadcast it globally
          const activeSessionId = localStorage.getItem("trustnet_active_sos_session");
          if (activeSessionId) {
            await updateLiveSOSLocation(activeSessionId, user.id, lat, lng);
          }
        } catch (err) {
          console.error("Failed to update live location:", err);
        }
      },
      (err) => {
        console.warn("Live location tracker error:", err);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [user]);
}
