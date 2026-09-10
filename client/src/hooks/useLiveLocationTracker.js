import { useEffect } from "react";
import { useAuth } from "../lib/auth";
import { updateMyLocation } from "../services/locationService";

export function useLiveLocationTracker() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // We check if sharing is explicitly disabled. If not set, default to true.
    const isSharingStr = localStorage.getItem("trustnet_location_sharing");
    const isSharing = isSharingStr === null || isSharingStr === "true";

    if (!isSharing) return;
    if (!navigator.geolocation) return;

    // Use watchPosition to continuously get the latest device location
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          // Update Firestore and LocalStorage
          await updateMyLocation(user.id, pos.coords.latitude, pos.coords.longitude);
          localStorage.setItem(
            "trustnet_browser_location",
            JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          );
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
