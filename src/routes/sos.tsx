import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Contact, Layer2Candidate } from "../types/contacts";
import { useLayer1Contacts, useLayer2Contacts } from "../hooks/useContacts";
import { triggerLayer2, triggerSOS, endSOS } from "../services/sosService";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  onSnapshot,
  getDoc,
  updateDoc,
  GeoPoint,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { triggerLayer3, updateGuardianRating, getDistance } from "../services/guardianService";
import { getNearestSafeSpace } from "../services/safeSpaceService";
import { updateLiveSOSLocation } from "../services/locationService";
import { useAuth } from "../lib/auth";
import { MapContainer, TileLayer, Marker, Circle, Polyline, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const createCustomIcon = (color: string) => L.divIcon({
  className: 'custom-leaflet-icon',
  html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const redIcon = createCustomIcon('#ef4444');
const tealIcon = createCustomIcon('#0d9488');
const amberIcon = createCustomIcon('#f59e0b');
const greyIcon = createCustomIcon('#9ca3af');
const greenIcon = createCustomIcon('#10b981');
const blueIcon = createCustomIcon('#3b82f6');

// Helper to compute percentage positions relative to center for mock map rendering
const getRelativePercent = (lat: number, lng: number, centerLat: number, centerLng: number) => {
  const scale = 11000; // scaling factor to map lat/lng diffs to percentage offsets
  const dLat = lat - centerLat;
  const dLng = lng - centerLng;
  const top = 50 - dLat * scale;
  const left = 50 + dLng * scale;
  return {
    top: `${Math.max(10, Math.min(90, top))}%`,
    left: `${Math.max(10, Math.min(90, left))}%`,
  };
};

export const Route = createFileRoute("/sos")({
  head: () => ({
    meta: [{ title: "TrustNet - Emergency SOS" }],
  }),
  component: SosEmergencyPage,
});

function SosEmergencyPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem("trustnet_active_sos_session"),
  );
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // MapResizer to fix rendering edge case
  const MapResizer = () => {
    const map = useMap();
    useEffect(() => {
      const timer = setTimeout(() => map.invalidateSize(), 250);
      return () => clearTimeout(timer);
    }, [map]);
    return null;
  };

  // Get location when component mounts (continuous tracking)
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (err) => {
        console.error("Error getting location:", err);
        setLocation((prev) => prev || { lat: 28.6139, lng: 77.209 });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const [activeState, setActiveState] = useState<
    "countdown" | "active" | "l2-searching" | "l3-searching" | "police-searching"
  >("countdown");
  const [secondsLeft, setSecondsLeft] = useState(10);
  const contacts = useLayer1Contacts();
  const layer2Contacts = useLayer2Contacts();

  // Dynamic timeouts (L1 -> 45s, L2 -> 45s)
  const [escalationTime, setEscalationTime] = useState(45);
  const [layer3EscalationTime, setLayer3EscalationTime] = useState(45);

  const [isLayer2Escalated, setIsLayer2Escalated] = useState(false);
  const [isLayer3Escalated, setIsLayer3Escalated] = useState(false);

  const [responderName, setResponderName] = useState<string | null>(null);
  const [responderUID, setResponderUID] = useState<string | null>(null);

  const [layer3Alerted, setLayer3Alerted] = useState<string[]>([]);
  const [layer3Declined, setLayer3Declined] = useState<string[]>([]);
  const [layer3Exhausted, setLayer3Exhausted] = useState(false);
  const [gaLocations, setGaLocations] = useState<any[]>([]);

  // Safe Spaces states
  const [nearestSpace, setNearestSpace] = useState<any>(null);

  // Safety confirmation states
  const [confirmSafety, setConfirmSafety] = useState(false);
  const [isSafeEnded, setIsSafeEnded] = useState(false);
  const [confirmTimeoutId, setConfirmTimeoutId] = useState<number | null>(null);

  // Post-SOS GA rating states
  const [gaRating, setGaRating] = useState<number | null>(null);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [gaSecondsLeft, setGaSecondsLeft] = useState(30);

  // Directions and Routes
  const [directionsToSafeSpace, setDirectionsToSafeSpace] = useState<any>(null);
  const [lastRoutedLocation, setLastRoutedLocation] = useState<{lat: number, lng: number} | null>(null);
  
  const [responderLocation, setResponderLocation] = useState<{lat: number, lng: number} | null>(null);
  const [responderRoute, setResponderRoute] = useState<any>(null);
  const [lastResponderRoutedLocation, setLastResponderRoutedLocation] = useState<{lat: number, lng: number} | null>(null);

  const [pulseRadius, setPulseRadius] = useState(500);

  // Real-time listener for this SOS session (never a shared demo document).
  useEffect(() => {
    if (!sessionId) return;
    const sessionRef = doc(db, "sos_sessions", sessionId);
    const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.active === false) {
          setIsSafeEnded(true);
        }
        if (data.responderName) {
          setResponderName(data.responderName);
        }
        if (data.responderUID) {
          setResponderUID(data.responderUID);
        }
        if (data.layerActive === 2) {
          setIsLayer2Escalated(true);
        } else if (data.layerActive === 3) {
          setIsLayer3Escalated(true);
        }
        if (data.layer3Alerted) {
          setLayer3Alerted(data.layer3Alerted);
        }
        if (data.layer3Declined) {
          setLayer3Declined(data.layer3Declined);
        }
        if (data.layer3Exhausted !== undefined) {
          if (data.layer3Exhausted === true && !layer3Exhausted) {
             setActiveState("police-searching");
          }
          setLayer3Exhausted(data.layer3Exhausted);
        }
      } else {
        localStorage.removeItem("trustnet_active_sos_session");
        localStorage.removeItem("trustnet_sos_state");
        setIsSafeEnded(true);
      }
    });

    return () => unsubscribe();
  }, [sessionId]);

  // Browser best-effort SOS tracking with background/battery-saving support
  useEffect(() => {
    if (!sessionId || !user || !location || activeState === "countdown" || isSafeEnded) return;

    let intervalId: number;

    const startPublishInterval = () => {
      const isBackground = document.visibilityState === "hidden";
      const intervalMs = isBackground ? 10_000 : 5_000; // 10s in background, 5s in foreground
      const publish = () =>
        updateLiveSOSLocation(sessionId, user.id, location.lat, location.lng).catch(console.error);

      publish();
      intervalId = window.setInterval(publish, intervalMs);
    };

    const handleVisibilityChange = () => {
      if (intervalId) window.clearInterval(intervalId);
      startPublishInterval();
    };

    startPublishInterval();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeState, isSafeEnded, location, sessionId, user]);

  // Fetch coordinates of alerted GAs to render gold pins
  useEffect(() => {
    if (layer3Alerted.length === 0) return;
    const fetchGALocations = async () => {
      try {
        const list = [];
        for (const gaUid of layer3Alerted) {
          const userSnap = await getDoc(doc(db, "users", gaUid));
          const locSnap = await getDoc(doc(db, "user_locations", gaUid));
          if (userSnap.exists() && locSnap.exists()) {
            list.push({
              uid: gaUid,
              name: userSnap.data().name,
              latitude: locSnap.data().latitude,
              longitude: locSnap.data().longitude,
            });
          }
        }
        setGaLocations(list);
      } catch (err) {
        console.error("Error loading GA locations:", err);
      }
    };
    fetchGALocations();
  }, [layer3Alerted]);

  // Continuously update closest Safe Space based on location updates
  useEffect(() => {
    if (!location) return;
    const fetchNearest = async () => {
      try {
        const space = await getNearestSafeSpace(location.lat, location.lng);
        setNearestSpace(space);
      } catch (err) {
        console.error("Error finding closest safe space:", err);
      }
    };
    fetchNearest();
  }, [location]);

  // Track Responder Location if someone has acknowledged
  useEffect(() => {
    if (!responderUID) return;
    const unsubscribe = onSnapshot(doc(db, "user_locations", responderUID), (snap) => {
      if (snap.exists() && snap.data().latitude) {
        setResponderLocation({ lat: snap.data().latitude, lng: snap.data().longitude });
      }
    });
    return () => unsubscribe();
  }, [responderUID]);

  // Directions to Safe Space
  useEffect(() => {
    if (!location || !nearestSpace || !(window as any).google) return;
    if (lastRoutedLocation) {
      const dist = getDistance(location.lat, location.lng, lastRoutedLocation.lat, lastRoutedLocation.lng);
      if (dist < 50) return;
    }
    const fetchRoute = async () => {
      const directionsService = new (window as any).google.maps.DirectionsService();
      try {
        const results = await directionsService.route({
          origin: location,
          destination: { lat: nearestSpace.latitude, lng: nearestSpace.longitude },
          travelMode: (window as any).google.maps.TravelMode.WALKING,
        });
        setDirectionsToSafeSpace(results);
        setLastRoutedLocation(location);
      } catch (err) {
        console.error("Directions to safe space failed", err);
      }
    };
    fetchRoute();
  }, [location, nearestSpace]);

  // Directions from Responder
  useEffect(() => {
    if (!location || !responderLocation || !(window as any).google) return;
    if (lastResponderRoutedLocation) {
      const dist = getDistance(responderLocation.lat, responderLocation.lng, lastResponderRoutedLocation.lat, lastResponderRoutedLocation.lng);
      if (dist < 50) return;
    }
    const fetchRoute = async () => {
      const directionsService = new (window as any).google.maps.DirectionsService();
      try {
        const results = await directionsService.route({
          origin: responderLocation,
          destination: location,
          travelMode: (window as any).google.maps.TravelMode.WALKING,
        });
        setResponderRoute(results);
        setLastResponderRoutedLocation(responderLocation);
      } catch (err) {
        console.error("Directions to responder failed", err);
      }
    };
    fetchRoute();
  }, [location, responderLocation]);

  // Pulse animation for coverage circles
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseRadius((prev) => (prev === 500 ? 530 : 500));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle countdown logic
  useEffect(() => {
    if (activeState !== "countdown") return;

    if (secondsLeft <= 0) {
      setActiveState("active");
      localStorage.setItem(
        "trustnet_sos_state",
        JSON.stringify({ status: "active", layer: 1, distressedUser: "Priya Sharma" }),
      );
      return;
    }

    const timer = setTimeout(() => {
      setSecondsLeft(secondsLeft - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [secondsLeft, activeState]);

  // L1 → L2 escalation timer (90s)
  useEffect(() => {
    if (activeState !== "active") return;
    if (isLayer2Escalated) return;
    if (responderName) return;
    if (escalationTime <= 0) {
      setActiveState("l2-searching");
      return;
    }
    const timer = setTimeout(() => setEscalationTime(escalationTime - 1), 1000);
    return () => clearTimeout(timer);
  }, [escalationTime, activeState, isLayer2Escalated, responderName]);

  // L2 → L3 escalation timer (120s)
  useEffect(() => {
    if (!isLayer2Escalated) return;
    if (isLayer3Escalated) return;
    if (responderName) return;
    if (layer3EscalationTime <= 0) {
      setActiveState("l3-searching");
      return;
    }
    const timer = setTimeout(() => setLayer3EscalationTime(layer3EscalationTime - 1), 1000);
    return () => clearTimeout(timer);
  }, [layer3EscalationTime, isLayer2Escalated, isLayer3Escalated, responderName]);

  // Layer 3 GA sequential timer countdown (60s per candidate)
  useEffect(() => {
    if (!isLayer3Escalated || isSafeEnded || responderName) return;
    if (gaSecondsLeft <= 0) {
      setGaSecondsLeft(30);
      return;
    }
    const timer = setTimeout(() => {
      setGaSecondsLeft((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [isLayer3Escalated, isSafeEnded, responderName, gaSecondsLeft]);

  // Reset GA timer when a GA declines (which signals moving to the next GA)
  useEffect(() => {
    if (isLayer3Escalated) {
      setGaSecondsLeft(30);
    }
  }, [layer3Declined.length, isLayer3Escalated]);

  // L2 searching transition
  useEffect(() => {
    if (activeState !== "l2-searching") return;
    const timer = setTimeout(async () => {
      setIsLayer2Escalated(true);
      setActiveState("active");

      // Write Layer 2 escalation to Firestore
      try {
        if (!sessionId || !location) return;
        await triggerLayer2(sessionId, new GeoPoint(location.lat, location.lng));
      } catch (err) {
        console.error("Failed to update L2 session:", err);
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [activeState, location, sessionId]);

  // L3 searching transition (Task 1 S4.1)
  useEffect(() => {
    if (activeState !== "l3-searching") return;
    const timer = setTimeout(async () => {
      setIsLayer3Escalated(true);
      setActiveState("active");

      // Write Layer 3 escalation to Firestore
      try {
        if (!sessionId) return;
        await triggerLayer3(sessionId);
        console.log("Firebase: Escalated to Layer 3");
      } catch (err) {
        console.error("Failed to escalate to Layer 3:", err);
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [activeState, sessionId]);

  // Police searching transition
  useEffect(() => {
    if (activeState !== "police-searching") return;
    const timer = setTimeout(() => {
      setActiveState("active");
    }, 4000);
    return () => clearTimeout(timer);
  }, [activeState]);

  // Trigger default L1 on mount when countdown finishes
  useEffect(() => {
    if (activeState !== "active") return;
    if (isLayer2Escalated || isLayer3Escalated) return;

    const triggerL1 = async () => {
      try {
        if (!user || sessionId) return;
        const newSessionId = await triggerSOS(
          user.id,
          location?.lat || 28.6139,
          location?.lng || 77.209,
        );
        setSessionId(newSessionId);
        localStorage.setItem("trustnet_active_sos_session", newSessionId);
        console.log("Firebase: SOS Session Created");
      } catch (err) {
        console.error("Firebase L1 trigger failed:", err);
      }
    };
    triggerL1();
  }, [activeState, location, sessionId, user]);

  // Cleanup safety double-tap timeout
  useEffect(() => {
    return () => {
      if (confirmTimeoutId) clearTimeout(confirmTimeoutId);
    };
  }, [confirmTimeoutId]);

  // Cancel before countdown completes
  const handleCancelCountdown = () => {
    localStorage.removeItem("trustnet_sos_state");
    router.navigate({ to: "/" });
  };

  // Double-tap safety stand-down
  const handleEndSosWithDoubleTap = async () => {
    if (!confirmSafety) {
      setConfirmSafety(true);
      const timeout = window.setTimeout(() => {
        setConfirmSafety(false);
      }, 3500);
      setConfirmTimeoutId(timeout);
    } else {
      if (confirmTimeoutId) {
        clearTimeout(confirmTimeoutId);
      }

      // Call Firebase endSOS (fire-and-forget to avoid UI blocking)
      if (sessionId) {
        endSOS(sessionId).catch((err) => {
          console.error("Firebase endSOS failed:", err);
        });
      }

      localStorage.removeItem("trustnet_active_sos_session");
      localStorage.removeItem("trustnet_sos_state");
      setIsSafeEnded(true);
    }
  };

  // Submit star feedback rating (Task 1 S4.5)
  const submitGARating = async (score: number) => {
    if (!responderUID) return;
    try {
      await updateGuardianRating(responderUID, score);
      setRatingSubmitted(true);
    } catch (err) {
      console.error("Failed to submit rating:", err);
    }
  };

  const r = 80;
  const c = 2 * Math.PI * r;

  // ── RENDER ENDED SCREEN ──
  if (isSafeEnded) {
    return (
      <div className="w-full min-h-screen bg-[#faf9fc] flex flex-col justify-between items-center p-6 text-gray-800 select-none animate-fade-in">
        <div className="flex-grow flex flex-col items-center justify-center max-w-sm mx-auto text-center gap-6">
          <div className="w-20 h-20 rounded-full bg-green-100 border-2 border-green-500 text-green-600 flex items-center justify-center shadow-lg animate-scale-in">
            <span className="material-symbols-outlined text-4xl font-black">check</span>
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              SOS ended. You are safe.
            </h1>
            <p className="text-sm text-gray-500 font-semibold mt-1">
              {responderName ? `${responderName} was responding.` : "The SOS broadcast has ended."}
            </p>
          </div>

          {/* S4.5: Post-SOS Star Rating prompt */}
          {responderUID && !ratingSubmitted ? (
            <div className="bg-white border-2 border-amber-100 rounded-3xl p-5 shadow-md w-full flex flex-col gap-4">
              <p className="text-xs font-bold text-gray-800">
                Rate your Guardian Angel, {responderName}:
              </p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setGaRating(star)}
                    className={`w-10 h-10 rounded-full text-lg flex items-center justify-center transition border ${
                      gaRating === star
                        ? "bg-amber-500 border-amber-500 text-white font-bold"
                        : "bg-gray-50 hover:bg-gray-100 text-gray-400 border-gray-200"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <button
                onClick={() => submitGARating(gaRating!)}
                disabled={gaRating === null}
                className={`py-3 rounded-xl font-bold text-xs transition ${
                  gaRating !== null
                    ? "bg-amber-500 hover:bg-amber-600 text-white"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                Submit Rating
              </button>
            </div>
          ) : (
            <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm">
              <p className="text-xs text-gray-655 leading-relaxed">
                Your safety contacts have been notified that you are safe. Thank you for using
                TrustNet.
              </p>
            </div>
          )}
        </div>
        <div className="w-full max-w-md pb-8">
          <button
            onClick={() => {
              localStorage.removeItem("trustnet_sos_state");
              router.navigate({ to: "/" });
            }}
            className="w-full bg-[#0d631b] hover:bg-[#0a5215] text-white font-bold py-4 rounded-xl shadow-md transition active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">home</span>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER SEARCHING L2 SCREEN ──
  if (activeState === "l2-searching") {
    return (
      <div className="w-full min-h-screen bg-indigo-900 flex flex-col justify-between items-center p-6 text-white select-none animate-fade-in relative">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-850 opacity-95 pointer-events-none" />

        <header className="text-center pt-12 z-10">
          <span className="material-symbols-outlined text-4xl text-indigo-300 animate-pulse">
            security
          </span>
          <h1 className="text-xl font-bold tracking-tight mt-3">Layer 2 Escalation</h1>
        </header>

        <div className="flex flex-col items-center justify-center gap-6 z-10 max-w-xs text-center">
          <div className="relative w-28 h-28 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full border-4 border-indigo-500/20 animate-ping" />
            <span className="absolute inset-4 rounded-full border-4 border-indigo-400/30 animate-pulse" />
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 border-2 border-indigo-300 flex items-center justify-center shadow-lg">
              <span
                className="material-symbols-outlined text-2xl text-indigo-200 animate-spin"
                style={{ animationDuration: "3s" }}
              >
                autorenew
              </span>
            </div>
          </div>
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-white/95">
              No response from your contacts.
            </h2>
            <p className="text-xs text-indigo-200/90 leading-relaxed mt-2.5 font-sans">
              Finding nearby people who know them...
            </p>
          </div>
        </div>

        <div className="w-full max-w-md pb-8 z-10 flex flex-col items-center">
          <button
            onClick={handleEndSosWithDoubleTap}
            className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/20 font-bold py-4 rounded-xl shadow-lg transition active:scale-[0.98] flex items-center justify-center gap-2 uppercase text-xs"
          >
            <span className="material-symbols-outlined text-sm">check_circle</span>I am safe — end
            SOS
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER SEARCHING L3 SCREEN ──
  if (activeState === "l3-searching") {
    return (
      <div className="w-full min-h-screen bg-amber-900 flex flex-col justify-between items-center p-6 text-white select-none animate-fade-in relative">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-950 via-amber-900 to-orange-900 opacity-95 pointer-events-none" />

        <header className="text-center pt-12 z-10">
          <span
            className="material-symbols-outlined text-4xl text-amber-300 animate-pulse"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            shield_with_heart
          </span>
          <h1 className="text-xl font-bold tracking-tight mt-3">Layer 3 — Guardian Angels</h1>
        </header>

        <div className="flex flex-col items-center justify-center gap-6 z-10 max-w-xs text-center">
          <div className="relative w-28 h-28 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full border-4 border-amber-400/20 animate-ping" />
            <span className="absolute inset-4 rounded-full border-4 border-amber-300/30 animate-pulse" />
            <div className="w-16 h-16 rounded-full bg-amber-400/10 border-2 border-amber-300 flex items-center justify-center shadow-lg">
              <span
                className="material-symbols-outlined text-2xl text-amber-200 animate-spin"
                style={{ animationDuration: "3s", fontVariationSettings: "'FILL' 1" }}
              >
                security
              </span>
            </div>
          </div>
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-white/95">
              No response from nearby contacts.
            </h2>
            <p className="text-xs text-amber-200/90 leading-relaxed mt-2.5 font-sans">
              Alerting verified Guardian Angels in your area...
            </p>
            <p className="text-[10px] text-amber-300/70 mt-2 font-medium">
              These are community-verified helpers who have volunteered to respond.
            </p>
          </div>
        </div>

        <div className="w-full max-w-md pb-8 z-10 flex flex-col items-center">
          <button
            onClick={handleEndSosWithDoubleTap}
            className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/20 font-bold py-4 rounded-xl shadow-lg transition active:scale-[0.98] flex items-center justify-center gap-2 uppercase text-xs"
          >
            <span className="material-symbols-outlined text-sm">check_circle</span>I am safe — end
            SOS
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER SEARCHING POLICE SCREEN ──
  if (activeState === "police-searching") {
    return (
      <div className="w-full min-h-screen bg-red-900 flex flex-col justify-between items-center p-6 text-white select-none animate-fade-in relative">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950 via-red-900 to-red-800 opacity-95 pointer-events-none" />

        <header className="text-center pt-12 z-10">
          <span
            className="material-symbols-outlined text-4xl text-red-300 animate-pulse"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            local_police
          </span>
          <h1 className="text-xl font-bold tracking-tight mt-3">Police Escalation</h1>
        </header>

        <div className="flex flex-col items-center justify-center gap-6 z-10 max-w-xs text-center">
          <div className="relative w-28 h-28 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full border-4 border-red-500/20 animate-ping" />
            <span className="absolute inset-4 rounded-full border-4 border-red-400/30 animate-pulse" />
            <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-300 flex items-center justify-center shadow-lg">
              <span
                className="material-symbols-outlined text-2xl text-red-200 animate-spin"
                style={{ animationDuration: "3s" }}
              >
                emergency
              </span>
            </div>
          </div>
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-white/95">
              No Guardian Angels available.
            </h2>
            <p className="text-xs text-red-200/90 leading-relaxed mt-2.5 font-sans">
              Directly alerting local authorities...
            </p>
          </div>
        </div>

        <div className="w-full max-w-md pb-8 z-10 flex flex-col items-center">
          <button
            onClick={handleEndSosWithDoubleTap}
            className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/20 font-bold py-4 rounded-xl shadow-lg transition active:scale-[0.98] flex items-center justify-center gap-2 uppercase text-xs"
          >
            <span className="material-symbols-outlined text-sm">check_circle</span>I am safe — end
            SOS
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER COUNTDOWN SCREEN ──
  if (activeState === "countdown") {
    return (
      <div className="w-full min-h-screen bg-red-600 flex flex-col justify-between items-center p-6 text-white select-none animate-fade-in relative">
        <div className="absolute inset-0 bg-radial-gradient from-red-500 via-red-600 to-red-700 pointer-events-none" />
        <span className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none" />

        <header className="text-center pt-8 z-10">
          <span className="material-symbols-outlined text-4xl animate-bounce">warning</span>
          <h1 className="text-2xl font-extrabold tracking-tight uppercase mt-2">
            Emergency Triggered
          </h1>
          <p className="text-sm opacity-85 max-w-xs mx-auto mt-2">
            An alert will be sent to your guardians and local emergency dispatch.
          </p>
        </header>

        <div className="relative w-56 h-56 flex items-center justify-center z-10">
          <svg
            className="absolute w-full h-full -rotate-90 pointer-events-none"
            viewBox="0 0 200 200"
          >
            <circle
              cx="100"
              cy="100"
              r={r}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="10"
              fill="none"
            />
            <circle
              cx="100"
              cy="100"
              r={r}
              stroke="#ffffff"
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - secondsLeft / 10)}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="flex flex-col items-center justify-center">
            <span className="text-7xl font-black tracking-tight leading-none">{secondsLeft}</span>
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] mt-1 text-red-250">
              Seconds
            </span>
          </div>
        </div>

        <div className="w-full max-w-md pb-8 z-10 flex flex-col gap-4">
          <button
            onClick={handleCancelCountdown}
            className="w-full bg-white hover:bg-gray-50 text-red-700 font-bold py-4 rounded-xl shadow-lg transition active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-wider text-xs"
          >
            <span className="material-symbols-outlined text-base">cancel</span>
            Cancel — I am safe
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER ACTIVE SOS SCREEN ──
  const getLayerColorClass = () => {
    if (layer3Exhausted) return "bg-red-700 text-white";
    if (isLayer3Escalated) return "bg-amber-600 text-white";
    if (isLayer2Escalated) return "bg-teal-600 text-white";
    return "bg-purple-600 text-white";
  };

  const getLayerBorderClass = () => {
    if (layer3Exhausted) return "border-red-500";
    if (isLayer3Escalated) return "border-amber-400";
    if (isLayer2Escalated) return "border-teal-400";
    return "border-purple-400";
  };

  const getLayerTitle = () => {
    if (layer3Exhausted) return "Layer 4: Direct Police Alerted";
    if (isLayer3Escalated) return "Layer 3: Guardian Angels Alerted";
    if (isLayer2Escalated) return "Layer 2: Friends-of-Friends Alerted";
    return "Layer 1: Direct Contacts Alerted";
  };

  // Safe Space positions relative
  const spacePos = nearestSpace
    ? getRelativePercent(
        nearestSpace.latitude,
        nearestSpace.longitude,
        location?.lat || 28.6139,
        location?.lng || 77.209,
      )
    : { top: "40%", left: "52%" };

  return (
    <div className="w-full min-h-screen bg-[#faf9fc] flex flex-col justify-between items-center text-gray-800 select-none animate-fade-in relative">
      {/* 1. Header Banner showing current layer color-coded */}
      <div
        className={`w-full px-5 py-3.5 flex items-center justify-between shadow-md relative overflow-hidden z-20 ${getLayerColorClass()}`}
      >
        <div className="absolute inset-0 bg-white/5 pointer-events-none"></div>
        <div className="flex items-center gap-2.5 relative z-10">
          <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
          <h2 className="font-extrabold text-[11px] uppercase tracking-wider font-sans leading-none">
            {getLayerTitle()}
          </h2>
        </div>
        <span className="text-xs font-black opacity-95 relative z-10">
          {!responderName &&
            (layer3Exhausted
              ? "L4 Active"
              : isLayer3Escalated
                ? `${gaSecondsLeft}s`
                : isLayer2Escalated
                  ? `${layer3EscalationTime}s`
                  : `${escalationTime}s`)}
        </span>
      </div>

      {/* 2. Map Canvas area */}
      <div className="flex-grow w-full relative overflow-hidden bg-gray-100 flex flex-col justify-center items-center h-[350px]">
        {location ? (
          <MapContainer
            center={[location.lat, location.lng]}
            zoom={15}
            zoomControl={false}
            style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
          >
            <MapResizer />
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
            
            {/* Live User Marker */}
            <Marker position={[location.lat, location.lng]} icon={redIcon}>
              <Tooltip permanent direction="top" offset={[0, -12]} className="font-bold">Priya (You)</Tooltip>
            </Marker>

            {/* Coverage radius circle representing active SOS boundary */}
            <Circle
              center={[location.lat, location.lng]}
              radius={isLayer3Escalated ? pulseRadius : isLayer2Escalated ? pulseRadius : pulseRadius / 5}
              pathOptions={{
                color: isLayer3Escalated ? "#f59e0b" : isLayer2Escalated ? "#0d9488" : "#8b5cf6",
                fillColor: isLayer3Escalated ? "#f59e0b" : isLayer2Escalated ? "#0d9488" : "#8b5cf6",
                fillOpacity: 0.05,
                weight: 2
              }}
            />

            {/* Nearest Safe Space Pin */}
            {nearestSpace && (
              <>
                <Circle center={[nearestSpace.latitude, nearestSpace.longitude]} radius={80} pathOptions={{ color: "#10b981", fillOpacity: 0.15, weight: 2 }} />
                <Marker position={[nearestSpace.latitude, nearestSpace.longitude]} icon={greenIcon}>
                   <Tooltip permanent direction="bottom" offset={[0, 12]} className="font-bold text-emerald-700">Safe Space: {nearestSpace.name}</Tooltip>
                </Marker>
                <Polyline positions={[[location.lat, location.lng], [nearestSpace.latitude, nearestSpace.longitude]]} pathOptions={{ color: "#10b981", weight: 3, dashArray: "10, 10" }} />
              </>
            )}

            {/* Layer 2 Candidate Mock Pins */}
            {isLayer2Escalated && !isLayer3Escalated && !responderName && (
              <>
                <Marker position={[location.lat + 0.002, location.lng + 0.002]} icon={tealIcon}>
                  <Tooltip permanent direction="top">Layer 2 — Rahul</Tooltip>
                </Marker>
                <Marker position={[location.lat - 0.002, location.lng - 0.002]} icon={tealIcon}>
                   <Tooltip permanent direction="top">Layer 2 — Dev</Tooltip>
                </Marker>
              </>
            )}

            {/* Guardian Angel Pins */}
            {isLayer3Escalated && gaLocations.map((ga) => {
                const isDeclined = layer3Declined.includes(ga.uid);
                const isActiveCandidate = !isDeclined && layer3Alerted.find((uid) => !layer3Declined.includes(uid)) === ga.uid;
                
                return (
                  <Marker key={ga.uid} position={[ga.latitude, ga.longitude]} icon={isDeclined ? greyIcon : isActiveCandidate ? amberIcon : amberIcon}>
                    <Tooltip permanent direction="top">{`GA — ${ga.name}${isDeclined ? " (No Response)" : ""}`}</Tooltip>
                  </Marker>
                )
            })}

            {/* Responding Helper route and Pin */}
            {responderName && (
              <>
                <Polyline 
                  positions={[[location.lat, location.lng], gaLocations.length > 0 ? [gaLocations[0].latitude, gaLocations[0].longitude] : [location.lat + 0.002, location.lng + 0.002]]}
                  pathOptions={{ color: "#3b82f6", weight: 4 }}
                />
                <Marker position={gaLocations.length > 0 ? [gaLocations[0].latitude, gaLocations[0].longitude] : [location.lat + 0.002, location.lng + 0.002]} icon={blueIcon}>
                   <Tooltip permanent direction="top" className="text-blue-700 font-bold">{responderName} (Responding!)</Tooltip>
                </Marker>
              </>
            )}
          </MapContainer>
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 animate-pulse">
            Loading Live Map...
          </div>
        )}

        {/* Live HUD indicator */}
        <div
          className={`absolute top-3 left-3 text-white px-3 py-1 rounded-full text-[9px] font-bold shadow z-20 ${getLayerColorClass()}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping mr-1 inline-block"></span>
          Live GPS Broadcast
        </div>
      </div>

      {/* 3. Dynamic Footer Card info */}
      <div className="w-full max-w-md p-4 bg-white/95 backdrop-blur border-t border-gray-200 z-20 flex flex-col gap-4">
        {/* Responder status */}
        <div className="flex items-center justify-between border-b border-gray-150 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 shrink-0">
              <span className="material-symbols-outlined">
                {responderName ? "person" : "autorenew"}
              </span>
            </div>
            <div>
              <h3 className="font-extrabold text-xs text-gray-900 leading-none">
                {responderName ? "Safety Partner Found" : "Searching for Responders..."}
              </h3>
              <p className="text-[10px] text-gray-400 mt-1">
                {responderName
                  ? `${responderName} is on the way to help you.`
                  : isLayer3Escalated
                    ? "Contacting verified community Guardian Angels..."
                    : isLayer2Escalated
                      ? "Pinging nearby friends-of-friends..."
                      : "Pinging primary guardians..."}
              </p>
            </div>
          </div>
        </div>

        {/* 4-Node Escalation Timeline */}
        <div className="flex justify-between items-center px-4 relative mt-1">
          <div className="absolute left-6 right-6 top-1/2 h-[3px] bg-gray-200 -translate-y-1/2 z-0 overflow-hidden">
            <div
              className="h-full bg-purple-600 transition-all duration-1000"
              style={{
                width: layer3Exhausted
                  ? "100%"
                  : isLayer3Escalated
                    ? "66%"
                    : isLayer2Escalated
                      ? "33%"
                      : "0%"
              }}
            />
          </div>

          {/* L1 Node */}
          <div className="flex flex-col items-center gap-1 z-10">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                isLayer2Escalated || isLayer3Escalated || responderName
                  ? "bg-purple-600 border-purple-600 text-white"
                  : "bg-purple-50 border-purple-600 text-purple-600 animate-pulse"
              }`}
            >
              1
            </div>
            <span className="text-[8px] font-black text-gray-400">L1</span>
          </div>

          {/* L2 Node */}
          <div className="flex flex-col items-center gap-1 z-10">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                isLayer3Escalated || (isLayer2Escalated && responderName)
                  ? "bg-teal-600 border-teal-600 text-white"
                  : isLayer2Escalated
                    ? "bg-teal-50 border-teal-600 text-teal-600 animate-pulse"
                    : "bg-gray-100 border-gray-300 text-gray-400"
              }`}
            >
              2
            </div>
            <span className="text-[8px] font-black text-gray-400">L2</span>
          </div>

          {/* L3 Node */}
          <div className="flex flex-col items-center gap-1 z-10">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                isLayer3Escalated && responderName
                  ? "bg-amber-500 border-amber-500 text-white"
                  : isLayer3Escalated
                    ? "bg-amber-50 border-amber-500 text-amber-500 animate-pulse"
                    : "bg-gray-100 border-gray-300 text-gray-400"
              }`}
            >
              3
            </div>
            <span className="text-[8px] font-black text-gray-400">GA</span>
          </div>

          {/* Police Node */}
          <div className="flex flex-col items-center gap-1 z-10">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                layer3Exhausted
                  ? "bg-red-600 border-red-650 text-white animate-pulse"
                  : "bg-gray-100 border-gray-300 text-gray-400"
              }`}
            >
              🚓
            </div>
            <span className="text-[8px] font-black text-gray-400">Police</span>
          </div>
        </div>

        {/* Task 2 S4.2 & S1.4: Persistent Nearest Safe Space Banner / layer3Exhausted Banner */}
        {nearestSpace && (
          <div
            className={`border rounded-2xl p-5 flex gap-4 items-center shadow-lg transition-all duration-500 ${
              layer3Exhausted
                ? "bg-emerald-600 border-emerald-500 text-white ring-8 ring-emerald-500/20 scale-[1.02] py-6 animate-pulse"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            <span
              className={`material-symbols-outlined shrink-0 transition-all ${
                layer3Exhausted ? "text-4xl text-white animate-bounce" : "text-2xl"
              }`}
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {nearestSpace.type === "police_station"
                ? "local_police"
                : nearestSpace.type === "pharmacy"
                  ? "local_pharmacy"
                  : "store"}
            </span>
            <div className="flex-1 min-w-0">
              <h4
                className={`font-black tracking-tight leading-snug ${
                  layer3Exhausted ? "text-sm text-white font-extrabold" : "text-xs text-emerald-900"
                }`}
              >
                {layer3Exhausted
                  ? "⚠️ SOS Alert Exhausted — Head to Safe Space"
                  : "Nearest verified Safe Space"}
              </h4>
              <p
                className={`mt-1.5 leading-relaxed font-semibold transition-all ${
                  layer3Exhausted ? "text-xs text-emerald-50 font-bold" : "text-[10px] text-emerald-700"
                }`}
              >
                {layer3Exhausted
                  ? `Walk to the nearest safe space now. Help is registered there. (${nearestSpace.name} is ${nearestSpace.distance}m · ~${Math.max(1, Math.ceil(nearestSpace.distance / 80))} min walk)`
                  : `${nearestSpace.name} is ${nearestSpace.distance}m away · ~${Math.max(1, Math.ceil(nearestSpace.distance / 80))} min walk`}
              </p>
            </div>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${nearestSpace.latitude},${nearestSpace.longitude}&travelmode=walking`}
              target="_blank"
              rel="noopener noreferrer"
              className={`px-4 py-3 font-extrabold text-xs uppercase rounded-xl transition shadow active:scale-[0.98] shrink-0 ${
                layer3Exhausted
                  ? "bg-white text-emerald-800 hover:bg-emerald-50 scale-105"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
            >
              Directions
            </a>
          </div>
        )}

        {/* Double-tap cancel button */}
        <button
          onClick={handleEndSosWithDoubleTap}
          className={`w-full font-black py-4 rounded-xl shadow-md transition active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-wide text-xs ${
            confirmSafety
              ? "bg-red-600 hover:bg-red-700 text-white border-2 border-red-500 animate-pulse"
              : "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
          }`}
        >
          <span className="material-symbols-outlined text-base">
            {confirmSafety ? "warning" : "check_circle"}
          </span>
          {confirmSafety ? "TAP AGAIN TO CONFIRM YOU ARE SAFE" : "I am safe — cancel SOS"}
        </button>
      </div>
    </div>
  );
}
