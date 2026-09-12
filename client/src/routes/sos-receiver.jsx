import { createFileRoute, Link, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { acknowledgeLayer3, declineLayer3 } from "../services/guardianService";
import {
  acknowledgeLayer2,
  acknowledgeSOS,
  declineLayer2,
  listenSOS,
  endSOS,
} from "../services/sosService";
import { subscribeToLiveSOSLocation, updateMyLocation } from "../services/locationService";
import { useAuth } from "../lib/auth";
import { UserAvatar } from "../components/ui/UserAvatar";

import { MapContainer, TileLayer, Marker, Polyline, Circle, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

function FlyToBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 1.2 });
    }
  }, [bounds, map]);
  return null;
}

export const Route = createFileRoute("/sos-receiver")({
  validateSearch: (search) => {
    return {
      role: search.role,
      sessionId: search.sessionId,
    };
  },
  head: () => ({
    meta: [{ title: "TrustNet - SOS Responder" }],
  }),
  component: SosReceiverPage,
});

function SosReceiverPage() {
  const { user } = useAuth();
  const userAvatarUrl = user?.avatar || user?.profile_photo || "";
  const userName = user?.name || "User";

  const [distressedUser, setDistressedUser] = useState(null);

  const router = useRouter();
  const search = useSearch({ from: "/sos-receiver" });
  const sessionId = search.sessionId;

  const [receiverState, setReceiverState] = useState(() => {
    try {
      const activeResp = localStorage.getItem("trustnet_active_response_session");
      if (activeResp) {
        const parsed = JSON.parse(activeResp);
        if (parsed.sessionId === sessionId) return "responding";
      }
    } catch (e) {}
    return "alert";
  });
  
  const [eta, setEta] = useState(6);
  const [distance, setDistance] = useState(0.85);
  const [routePolyline, setRoutePolyline] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [isRouting, setIsRouting] = useState(false);

  // Tracking SOS status and layer information
  const [sosStatus, setSosStatus] = useState("active");
  const [sosLayer, setSosLayer] = useState(1);
  const [mutualContactName, setMutualContactName] = useState("Riya");

  // Responder coordinates tracked via browser geolocation
  const [responderLoc, setResponderLoc] = useState(null);
  const [liveLocation, setLiveLocation] = useState(null);

  // 60-second response countdown window for GAs (Task 1 S4.2)
  const [responseWindow, setResponseWindow] = useState(60);

  // Load responder profile or default
  const [responderUID, setResponderUID] = useState("ga_jaipur_1");

  const distressName = distressedUser?.name || distressedUser?.displayName || "Someone";
  const distressFirstName = distressName.split(" ")[0];
  const distressPhone = distressedUser?.phone || distressedUser?.phone_no || "";

  useEffect(() => {
    try {
      const authRaw = localStorage.getItem("trustnet_auth_user");
      if (authRaw) {
        const parsed = JSON.parse(authRaw);
        if (parsed.id) {
          setResponderUID(parsed.id);
        }
      }
  } catch {
      // Fallback
    }
  }, []);

  const getAvatarIcon = (url, name, borderColor) => {
    return L.divIcon({
      className: "custom-avatar-marker",
      html: `<div style="width:48px;height:48px;border-radius:50%;overflow:hidden;border:4px solid ${borderColor};box-shadow:0 4px 8px rgba(0,0,0,0.5);background:white;display:flex;align-items:center;justify-content:center;font-weight:bold;color:#333;font-size:18px"><img src="${url || ''}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'" />${!url ? name.charAt(0) : ''}</div>`,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
  };

  const calculateRoute = async (targetLat, targetLng) => {
    if (!responderLoc || !targetLat || !targetLng) return;
    setIsRouting(true);
    try {
      const origin = { lat: responderLoc.lat, lng: responderLoc.lng };
      const dest = { lat: targetLat, lng: targetLng };
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`,
      );
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const latLngs = route.geometry.coordinates.map((coord) => [coord[1], coord[0]]);
        setRoutePolyline(latLngs);
        setDistance((route.distance / 1000).toFixed(2));
        setEta(Math.ceil(route.duration / 60));

        const bounds = L.latLngBounds([origin.lat, origin.lng], [dest.lat, dest.lng]);
        setMapBounds(bounds);
      }
    } catch (err) {
      console.error("Failed to calculate route:", err);
    }
    setIsRouting(false);
  };



  // Watch responder's current location continuously
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setResponderLoc({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        console.error("Error watching responder location:", err);
        setResponderLoc((prev) => prev || { lat: 28.6145, lng: 77.2085 });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Publish responder's live location to Firestore while responding
  useEffect(() => {
    if (receiverState !== "responding" || sosStatus === "ended" || !responderUID || !responderLoc)
      return;

    const publishLocation = async () => {
      try {
        await updateMyLocation(responderUID, responderLoc.lat, responderLoc.lng);
      } catch (err) {
        console.error("Failed to publish responder location:", err);
      }
    };

    publishLocation();
    const interval = setInterval(publishLocation, 10000); // every 10 seconds
    return () => clearInterval(interval);
  }, [receiverState, sosStatus, responderUID, responderLoc]);

  // Real-time session and distress-location feeds when this receiver was opened
  // from a session-scoped notification.
  useEffect(() => {
    if (!sessionId) return;
    return listenSOS(sessionId, async (session) => {
      if (session.status === "ended" || session.status === "cancelled" || session.status === "resolved" || session.active === false) {
        setSosStatus("ended");
      }
      
      // If someone else already claimed it
      if (session.responderUID && session.responderUID !== responderUID) {
        setSosStatus("already_accepted");
        setReceiverState("already_accepted");
      }

      if (session.layerActive) setSosLayer(session.layerActive);

      if (session.triggeredBy) {
        try {
          const { getFirestore, doc, getDoc } = await import("firebase/firestore");
          const db = getFirestore();
          const userSnap = await getDoc(doc(db, "users", session.triggeredBy));
          if (userSnap.exists()) {
            setDistressedUser(userSnap.data());
          }
        } catch (err) {
          console.error("Error loading distressed user profile:", err);
        }
      }
    });
  }, [sessionId, responderUID]);

  useEffect(() => {
    if (!sessionId) return;
    return subscribeToLiveSOSLocation(sessionId, setLiveLocation);
  }, [sessionId]);

  // Sync SOS status with localStorage to check for dynamic updates
  useEffect(() => {
    const checkSosState = () => {
      try {
        const raw = localStorage.getItem("trustnet_sos_state");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.status === "ended") {
            setSosStatus("ended");
            if (receiverState === "responding") {
              setReceiverState("thankyou");
            }
          } else {
            setSosStatus("active");
          }
          if (parsed.layer) {
            setSosLayer(parsed.layer);
          }
          if (parsed.notifiedLayer2 && parsed.notifiedLayer2.length > 0) {
            setMutualContactName(parsed.notifiedLayer2[0].mutualContact || "Riya");
          }
        }
      } catch {
        // Fallback
      }
    };

    checkSosState();
    const interval = setInterval(checkSosState, 1000);
    return () => clearInterval(interval);
  }, [receiverState]);

  // Determine if this is a Layer 2 or Layer 3 view
  const isLayer2 = search.role === "layer2" || sosLayer === 2;
  const isLayer3 = search.role === "layer3" || sosLayer === 3;

  // 60s response countdown effect for GAs (Task 1 S4.2)
  useEffect(() => {
    if (receiverState !== "alert") return;
    if (!isLayer3) return;

    if (responseWindow <= 0) {
      handleDeclineRequest(); // auto-decline on timeout
      return;
    }

    const timer = setTimeout(() => {
      setResponseWindow((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [responseWindow, receiverState, isLayer3]);

  // Stable fuzzy offset calculation
  const getFuzzyOffset = (lat, lng, sId) => {
    let hash = 0;
    for (let i = 0; i < sId.length; i++) {
      hash = sId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const angle = (Math.abs(hash) % 360) * (Math.PI / 180);
    const dist = 100 + (Math.abs(hash >> 3) % 101); // 100m to 200m
    const latOffset = (dist * Math.cos(angle)) / 111000;
    const lngOffset = (dist * Math.sin(angle)) / 98000;
    return { lat: lat + latOffset, lng: lng + lngOffset };
  };

  // Helper for GPS coordinates mapping to UI percentage bounds
  const getMapPosition = (lat, lng) => {
    if (!liveLocation) {
      return { top: 45, left: 50 };
    }
    const dLat = liveLocation.latitude ?? 28.6139;
    const dLng = liveLocation.longitude ?? 77.209;
    const rLat = responderLoc?.lat ?? 28.6145;
    const rLng = responderLoc?.lng ?? 77.2085;

    const latMin = Math.min(dLat, rLat);
    const latMax = Math.max(dLat, rLat);
    const lngMin = Math.min(dLng, rLng);
    const lngMax = Math.max(dLng, rLng);

    const latDelta = Math.max(0.002, latMax - latMin);
    const lngDelta = Math.max(0.002, lngMax - lngMin);

    const minLat = latMin - latDelta * 0.2;
    const maxLat = latMax + latDelta * 0.2;
    const minLng = lngMin - lngDelta * 0.2;
    const maxLng = lngMax + lngDelta * 0.2;

    const xPercent = ((lng - minLng) / (maxLng - minLng)) * 100;
    const yPercent = ((maxLat - lat) / (maxLat - minLat)) * 100;

    return {
      top: Math.min(92, Math.max(8, yPercent)),
      left: Math.min(92, Math.max(8, xPercent)),
    };
  };

  const getHaversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Dynamically update distance & ETA based on real GPS coordinates
  useEffect(() => {
    if (receiverState === "responding") {
      const dLat = liveLocation?.latitude ?? 28.6139;
      const dLng = liveLocation?.longitude ?? 77.209;
      
      const showFuzzy = (isLayer2 || isLayer3) && receiverState !== "responding";
      const fuzzy = getFuzzyOffset(dLat, dLng, sessionId || "default");
      const targetLat = showFuzzy ? fuzzy.lat : dLat;
      const targetLng = showFuzzy ? fuzzy.lng : dLng;
      
      calculateRoute(targetLat, targetLng);
    } else if (liveLocation && responderLoc) {
      const dLat = liveLocation.latitude ?? 28.6139;
      const dLng = liveLocation.longitude ?? 77.209;
      const rLat = responderLoc.lat;
      const rLng = responderLoc.lng;
      const dist = getHaversineDistance(rLat, rLng, dLat, dLng);
      setDistance(Number(dist.toFixed(2)));
      const nextEta = Math.max(1, Math.ceil(dist * 12)); // ~12 mins per km
      setEta(nextEta);
    }
  }, [liveLocation, responderLoc, receiverState, isLayer2, isLayer3, sessionId]);

  // Ensure map bounds always include both pins, even if route API fails
  useEffect(() => {
    if (liveLocation && responderLoc) {
      let rLat = responderLoc.lat;
      let rLng = responderLoc.lng;
      let dLat = liveLocation.latitude ?? 28.6139;
      let dLng = liveLocation.longitude ?? 77.209;
      
      if (Math.abs(rLat - dLat) < 0.0001 && Math.abs(rLng - dLng) < 0.0001) {
        // Add tiny padding if coordinates are identical to prevent Leaflet from max-zooming
        rLat += 0.001;
        dLat -= 0.001;
      }
      setMapBounds(L.latLngBounds([dLat, dLng], [rLat, rLng]));
    }
  }, [liveLocation, responderLoc]);


  const distressLat = liveLocation?.latitude ?? 28.6139;
  const distressLng = liveLocation?.longitude ?? 77.209;
  
  let responderLat = responderLoc?.lat ?? 28.6145;
  let responderLng = responderLoc?.lng ?? 77.2085;

  // Add a tiny visual offset if they are perfectly overlapping so both pins are visible
  if (Math.abs(responderLat - distressLat) < 0.0001 && Math.abs(responderLng - distressLng) < 0.0001) {
    responderLat += 0.0005;
    responderLng += 0.0005;
  }

  const distressPosExact = getMapPosition(distressLat, distressLng);

  // Fuzzy location centered at stable offset
  const fuzzyCoords = getFuzzyOffset(distressLat, distressLng, sessionId || "default");
  const distressPosFuzzy = getMapPosition(fuzzyCoords.lat, fuzzyCoords.lng);

  // Decide which position to show for distress user
  const showFuzzy = (isLayer2 || isLayer3) && receiverState !== "responding";
  const distressPos = showFuzzy ? distressPosFuzzy : distressPosExact;

  const responderPos = getMapPosition(responderLat, responderLng);

  // Show Pre-Response confirmation before responding
  const handleStartHelp = () => {
    if (isLayer2) {
      setReceiverState("confirm");
    } else {
      handleConfirmRespond();
    }
  };

  // Confirm assistance in Firestore (Task 1 S3.3)
  const handleConfirmRespond = async () => {
    setReceiverState("responding");
    try {
      if (!sessionId) throw new Error("This alert has no SOS session");
      if (isLayer2) await acknowledgeLayer2(sessionId, responderUID);
      else if (isLayer3) await acknowledgeLayer3(sessionId, responderUID);
      else await acknowledgeSOS(sessionId, responderUID);
      console.log("Firebase: Acknowledged Layer 3 Alert");

      // Save active response session to prevent redirect map resets
      localStorage.setItem(
        "trustnet_active_response_session",
        JSON.stringify({ sessionId, role: search.role })
      );

      // Update local storage so checkResponder updates local states if needed
      const raw = localStorage.getItem("trustnet_sos_state");
      const currentState = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        "trustnet_sos_state",
        JSON.stringify({
          ...currentState,
          responderName: isLayer3 ? "Rakesh Kumar" : "Rahul Sharma",
        }),
      );
    } catch (err) {
      console.error("Firebase acknowledge failed:", err);
    }
  };

  // Decline assistance in Firestore (Task 1 S4.3 / S3.5)
  const handleDeclineRequest = async () => {
    setReceiverState("declined");
    try {
      if (!sessionId) throw new Error("This alert has no SOS session");
      if (isLayer2) await declineLayer2(sessionId, responderUID);
      else if (isLayer3) await declineLayer3(sessionId, responderUID);
      console.log("Firebase: Declined Layer 3 Alert");

      // Record decline to local stashed state
      const raw = localStorage.getItem("trustnet_sos_state");
      const currentState = raw ? JSON.parse(raw) : {};
      const currentDeclined = currentState.declinedResponders || [];
      localStorage.setItem(
        "trustnet_sos_state",
        JSON.stringify({
          ...currentState,
          declinedResponders: [...currentDeclined, responderUID],
        }),
      );
    } catch (err) {
      console.error("Firebase decline failed:", err);
    }

    setTimeout(() => {
      localStorage.removeItem("trustnet_active_response_session");
      router.navigate({ to: "/" });
    }, 4000);
  };

  // Mark distressed person as secure and end the SOS session globally
  const handleMarkSecure = async () => {
    try {
      if (!sessionId) throw new Error("This alert has no SOS session");
      
      // We will let the user know we're marking it safe
      const confirmSafe = window.confirm(`Are you sure you want to mark ${distressFirstName} as safe and end the SOS broadcast?`);
      if (!confirmSafe) return;
      
      await endSOS(sessionId);
      console.log("Firebase: Marked SOS as secure by responder");
      
      // Cleanup local state
      localStorage.removeItem("trustnet_sos_state");
      localStorage.removeItem("trustnet_active_response_session");
      
      setSosStatus("ended");
      setReceiverState("thankyou");
    } catch (err) {
      console.error("Firebase mark secure failed:", err);
    }
  };

  // Clear URL params and return home
  const handleCleanEndedState = () => {
    localStorage.removeItem("trustnet_sos_state");
    localStorage.removeItem("trustnet_active_response_session");
    router.navigate({ to: "/" });
  };

  // ── RENDER THANK YOU SCREEN ──
  if (receiverState === "thankyou") {
    return (
      <div className="w-full min-h-screen bg-[#faf9fc] flex flex-col justify-between items-center p-6 text-gray-800 select-none animate-fade-in">
        <div className="flex-grow flex flex-col items-center justify-center max-w-sm mx-auto text-center gap-6">
          <div className="w-24 h-24 rounded-full bg-indigo-50 border-4 border-indigo-300 text-indigo-700 flex items-center justify-center shadow-lg animate-scale-in">
            <span className="material-symbols-outlined text-5xl font-black">favorite</span>
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-snug">
              You helped someone feel safer today. Thank you.
            </h1>
            <p className="text-xs text-gray-500 font-semibold mt-2.5 leading-relaxed font-sans">
              Your swift response as a community helper makes a meaningful difference in our
              network.
            </p>
          </div>
          <div className="bg-white border border-gray-150 rounded-2xl p-4.5 shadow-sm">
            <p className="text-[11px] text-gray-655 leading-relaxed italic">
              "TrustNet functions because neighbors look out for one another. You provided
              reassurance when it mattered most."
            </p>
          </div>
        </div>
        <div className="w-full max-w-md pb-8">
          <button
            onClick={handleCleanEndedState}
            className="w-full bg-indigo-700 hover:bg-indigo-800 text-white font-bold py-4 rounded-xl shadow-md transition active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">home</span>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER DECLINED SCREEN ──
  if (receiverState === "declined") {
    return (
      <div className="w-full min-h-screen bg-[#faf9fc] flex flex-col justify-center items-center p-6 text-gray-800 select-none animate-fade-in">
        <div className="text-center max-w-sm flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-4xl text-gray-400 animate-pulse">
            cancel
          </span>
          <h2 className="text-base font-extrabold text-gray-800">Request Declined</h2>
          <p className="text-xs text-gray-500 leading-normal font-sans">
            Declining safety request. Alerting next ranked responder in the safety graph. Returning
            to dashboard...
          </p>
        </div>
      </div>
    );
  }

  // ── RENDER CANCELLED BY USER SCREEN ──
  if (sosStatus === "ended") {
    return (
      <div className="w-full min-h-screen bg-[#faf9fc] flex flex-col justify-between items-center p-6 text-gray-800 select-none animate-fade-in">
        <div className="flex-grow flex flex-col items-center justify-center max-w-sm mx-auto text-center gap-6">
          <div className="w-20 h-20 rounded-full bg-green-100 border-2 border-green-500 text-green-600 flex items-center justify-center shadow-lg animate-scale-in">
            <span className="material-symbols-outlined text-4xl font-black">shield</span>
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">
              {receiverState === "thankyou" 
                ? `You marked ${distressFirstName} as safe.` 
                : `${distressFirstName} has marked themselves safe.`}
            </h1>
            <p className="text-sm text-gray-500 font-semibold mt-1">Thank you for responding.</p>
          </div>
          <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm">
            <p className="text-xs text-gray-655 leading-relaxed">
              The emergency broadcast has been successfully cancelled. Your alert access and route
              navigation keys have been safely cleared.
            </p>
          </div>
        </div>
        <div className="w-full max-w-md pb-8">
          <button
            onClick={handleCleanEndedState}
            className="w-full bg-[#0d631b] hover:bg-[#0a5215] text-white font-bold py-4 rounded-xl shadow-md transition active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">home</span>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER ALREADY ACCEPTED BY OTHER ──
  if (receiverState === "already_accepted" || sosStatus === "already_accepted") {
    return (
      <div className="w-full min-h-screen bg-[#faf9fc] flex flex-col justify-between items-center p-6 text-gray-800 select-none animate-fade-in">
        <div className="flex-grow flex flex-col items-center justify-center max-w-sm mx-auto text-center gap-6">
          <div className="w-20 h-20 rounded-full bg-blue-100 border-2 border-blue-500 text-blue-600 flex items-center justify-center shadow-lg animate-scale-in">
            <span className="material-symbols-outlined text-4xl font-black">handshake</span>
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">
              Helped by another responder
            </h1>
            <p className="text-sm text-gray-500 font-semibold mt-1">Thank you for being ready.</p>
          </div>
          <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm">
            <p className="text-xs text-gray-655 leading-relaxed">
              Another member of the TrustNet network has already accepted this SOS and is en route to {distressFirstName}. Your assistance is no longer required.
            </p>
          </div>
        </div>
        <div className="w-full max-w-md pb-8">
          <button
            onClick={handleCleanEndedState}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-md transition active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">home</span>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen relative flex flex-col md:flex-row bg-[#faf9fc]">

      {/* Mobile Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200 flex items-center justify-between px-4 h-16 w-full md:hidden text-gray-800">
        <div className="flex items-center gap-2.5">
          <span
            className={`material-symbols-outlined ${isLayer3 ? "text-amber-500 animate-pulse" : isLayer2 ? "text-indigo-600 animate-pulse" : "text-red-600 animate-bounce"}`}
          >
            {isLayer3 ? "shield_with_heart" : isLayer2 ? "security" : "warning"}
          </span>
          <span className="font-extrabold text-sm uppercase tracking-wide">
            {isLayer3 ? "GA Responder" : isLayer2 ? "L2 Responder" : "SOS Responder"}
          </span>
        </div>
        <button
          onClick={handleDeclineRequest}
          className="text-xs font-bold text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition"
        >
          Decline
        </button>
      </header>

      {/* Main Map Area */}
      <main className="flex-grow relative w-full  h-[calc(100vh-4rem)] md:h-screen bg-gray-200 overflow-hidden flex flex-col">
        {/* Real Leaflet Map */}
        <div className="absolute inset-0 w-full h-full z-0">
          <MapContainer
            center={[distressLat, distressLng]}
            zoom={15}
            zoomControl={false}
            style={{ height: "100%", width: "100%" }}
          >
            <MapResizer />
            {mapBounds && <FlyToBounds bounds={mapBounds} />}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Distressed User Pin */}
            <Marker 
              position={showFuzzy ? [fuzzyCoords.lat, fuzzyCoords.lng] : [distressLat, distressLng]}
              zIndexOffset={1000}
              icon={getAvatarIcon(
                distressedUser?.avatar || distressedUser?.profile_photo || "",
                distressName,
                isLayer3 ? "#f59e0b" : isLayer2 ? "#4f46e5" : "#ef4444"
              )}
            >
              <Tooltip permanent direction="top" offset={[0, -20]} className="font-bold">
                {distressName}
              </Tooltip>
              <Popup>
                <div className="font-bold text-xs">{distressName}</div>
                <div className="text-[10px] text-gray-500">
                  {isLayer3 ? "Guardian Alert" : isLayer2 ? `Friend of ${mutualContactName}` : "Trusted Contact"}
                </div>
                {receiverState === "responding" && distance > 0 && (
                  <div className="text-xs font-bold text-blue-600 mt-1">
                    {distance} km away (~{eta} min)
                  </div>
                )}
              </Popup>
            </Marker>

            {/* Fuzzy Radius for Privacy Modes */}
            {showFuzzy && (
              <Circle
                center={[fuzzyCoords.lat, fuzzyCoords.lng]}
                radius={200}
                pathOptions={{ 
                  color: isLayer3 ? "#f59e0b" : "#4f46e5", 
                  fillColor: isLayer3 ? "#f59e0b" : "#4f46e5", 
                  fillOpacity: 0.1, 
                  weight: 2,
                  dashArray: "4,4"
                }}
              />
            )}

            {/* Responder Pin */}
            {responderLoc && (
              <Marker
                position={[responderLat, responderLng]}
                zIndexOffset={500}
                icon={L.divIcon({
                  className: "custom-avatar-marker",
                  html: `<div style="width:40px;height:40px;border-radius:50%;border:3px solid white;box-shadow:0 3px 6px rgba(0,0,0,0.4);background:${isLayer3 ? '#f59e0b' : isLayer2 ? '#4f46e5' : '#2563eb'};display:flex;align-items:center;justify-content:center;color:white;"><span class="material-symbols-outlined" style="font-size:20px;font-variation-settings:'FILL' 1;">directions_run</span></div>`,
                  iconSize: [40, 40],
                  iconAnchor: [20, 20],
                })}
              >
                <Tooltip permanent direction="top" offset={[0, -20]} className="font-bold">
                  {user?.displayName || user?.name || "You"} (You)
                </Tooltip>
              </Marker>
            )}

            {/* Route Polyline (OSRM or straight line fallback) */}
            {routePolyline ? (
              <Polyline 
                positions={routePolyline} 
                color={isLayer3 ? "#f59e0b" : isLayer2 ? "#4f46e5" : "#2563eb"} 
                weight={6} 
                opacity={0.8} 
              />
            ) : (
              receiverState === "responding" && responderLoc && (
                <Polyline 
                  positions={[
                    [distressLat, distressLng],
                    [responderLat, responderLng]
                  ]} 
                  pathOptions={{ color: isLayer3 ? "#f59e0b" : isLayer2 ? "#4f46e5" : "#2563eb", weight: 4, dashArray: "10,10" }} 
                />
              )
            )}
          </MapContainer>
        </div>

        {/* SOS Alert HUD banner */}
        <div className="absolute top-4 left-4 right-4 z-20 flex flex-col gap-3 pointer-events-none">
          <div
            className={`text-white rounded-2xl shadow-xl p-4 flex gap-3 items-center pointer-events-auto max-w-lg mx-auto w-full border ${
              isLayer3
                ? "bg-amber-800/95 border-amber-600"
                : isLayer2
                  ? "bg-indigo-900/95 border-indigo-750"
                  : "bg-red-600/95 border-red-500"
            }`}
          >
            <span
              className="material-symbols-outlined text-2xl animate-bounce"
              style={{ fontVariationSettings: isLayer3 || isLayer2 ? "'FILL' 1" : undefined }}
            >
              {isLayer3 ? "shield_with_heart" : isLayer2 ? "security" : "warning"}
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="font-extrabold text-sm uppercase tracking-wide truncate">
                {isLayer3
                  ? "Guardian Angel Alert"
                  : isLayer2
                    ? "Friends-of-Friends Alert"
                    : "Emergency SOS Broadcast"}
              </h2>
              <p className="text-[11px] opacity-90 mt-0.5 font-medium leading-relaxed font-sans">
                {isLayer3
                  ? `Someone nearby needs urgent help (approximately 400m from you)`
                  : isLayer2
                    ? `A friend of ${mutualContactName} needs help nearby (approximately 300m from you)`
                    : `${distressName} has triggered an SOS alert!`}
              </p>
            </div>
          </div>
        </div>

        {/* HUD Details & Action Panel */}
        <div className="absolute bottom-4 left-4 right-4 z-30 bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 flex flex-col gap-4 max-w-md mx-auto pointer-events-auto">
          {/* Trust Signal Badge — Layer 2 or Layer 3 */}
          {(isLayer2 || isLayer3) && (
            <div
              className={`flex justify-between items-center px-3 py-2 rounded-xl border ${
                isLayer3 ? "bg-amber-50/60 border-amber-200" : "bg-indigo-50/60 border-indigo-105"
              }`}
            >
              <span
                className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                  isLayer3 ? "text-amber-800" : "text-indigo-750"
                }`}
              >
                <span
                  className="material-symbols-outlined text-xs"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {isLayer3 ? "shield_with_heart" : "group"}
                </span>
                {isLayer3 ? "Guardian Angel Alert" : `Sent as friend of ${mutualContactName}`}
              </span>
              <span
                className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                  isLayer3 ? "text-amber-700 bg-amber-100" : "text-indigo-600 bg-indigo-100"
                }`}
              >
                {isLayer3 ? "Layer 3" : "Layer 2"} Alert
              </span>
            </div>
          )}

          {receiverState === "responding" ? (
            // Responding status active card
            <div className="flex flex-col gap-3 text-gray-850">
              <div className="flex justify-between items-start">
                <div>
                  <h3
                    className={`font-bold text-gray-900 text-sm flex items-center gap-1.5 ${isLayer3 ? "text-amber-950" : isLayer2 ? "text-indigo-955" : ""}`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full animate-pulse ${isLayer3 ? "bg-amber-500" : isLayer2 ? "bg-indigo-600" : "bg-blue-600"}`}
                    ></span>
                    En Route to {distressFirstName}
                  </h3>
                  <p className="text-[11px] text-gray-550 mt-0.5">
                    Simulated response navigation active
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`text-xs font-bold block ${isLayer3 ? "text-amber-700" : isLayer2 ? "text-indigo-700" : "text-blue-600"}`}
                  >
                    ETA: {eta} mins
                  </span>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    {distance} km remaining
                  </span>
                </div>
              </div>

              <hr className="border-gray-150" />

              <div className={`border rounded-xl p-3 flex gap-2.5 items-start ${
                isLayer3 ? "bg-amber-50/70 border-amber-100" :
                isLayer2 ? "bg-indigo-50/70 border-indigo-100" :
                "bg-blue-50/70 border-blue-100"
              }`}>
                <span className={`material-symbols-outlined text-lg mt-0.5 font-bold ${
                  isLayer3 ? "text-amber-600" : isLayer2 ? "text-indigo-700" : "text-blue-600"
                }`}>
                  {isRouting ? "hourglass_empty" : "route"}
                </span>
                <div>
                  <h4 className={`font-bold text-xs ${
                    isLayer3 ? "text-amber-900" : isLayer2 ? "text-indigo-900" : "text-blue-900"
                  }`}>
                    {isRouting ? "Calculating Route..." : "Route Active"}
                  </h4>
                  <p className={`text-[10px] leading-relaxed mt-0.5 font-sans ${
                    isLayer3 ? "text-amber-900/80" : isLayer2 ? "text-indigo-900/80" : "text-blue-900/80"
                  }`}>
                    {isLayer2 || isLayer3
                      ? `Follow the ${isLayer3 ? 'amber' : 'indigo'} route to the search area for ${distressFirstName}.`
                      : `Follow the blue route line to navigate directly to ${distressFirstName}.`}
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5 mt-1">
                <button
                  onClick={() => setReceiverState("alert")}
                  className="flex-1 py-3 border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold rounded-xl transition flex justify-center items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">cancel</span>
                  Abort Response
                </button>
                {distressPhone ? (
                  <a
                    href={`tel:${distressPhone}`}
                    className="flex-1 py-3 bg-[#0d631b] hover:bg-[#0a5215] text-white text-xs font-bold rounded-xl transition flex justify-center items-center gap-1.5 shadow"
                  >
                    <span className="material-symbols-outlined text-sm">call</span>
                    Call {distressFirstName}
                  </a>
                ) : (
                  <button
                    disabled
                    title="Phone number unavailable"
                    className="flex-1 py-3 bg-gray-200 text-gray-500 text-xs font-bold rounded-xl flex justify-center items-center gap-1.5 shadow cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-sm">phone_disabled</span>
                    No Number
                  </button>
                )}
              </div>

              <div className="mt-2 w-full">
                <button
                  onClick={handleMarkSecure}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md transition active:scale-[0.98] flex justify-center items-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">verified_user</span>
                  Mark {distressFirstName} as Secure
                </button>
              </div>
            </div>
          ) : (
            // Initial Action required screen
            <div className="flex flex-col gap-3.5 text-gray-850">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                    isLayer3
                      ? "bg-amber-50 border-amber-100 text-amber-600"
                      : isLayer2
                        ? "bg-indigo-50 border-indigo-100 text-indigo-700"
                        : "bg-red-100 border-red-50 text-red-600"
                  }`}
                >
                  <span
                    className="material-symbols-outlined text-xl"
                    style={{ fontVariationSettings: "'FILL' 1'" }}
                  >
                    {isLayer3 ? "security" : isLayer2 ? "language" : "emergency_share"}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 leading-none">
                    {isLayer3
                      ? `Guardian Angel SOS Alert (${responseWindow}s left)`
                      : isLayer2
                        ? `Mutual Connection: ${mutualContactName}`
                        : "Immediate Action Required"}
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-1.5">
                    {isLayer3
                      ? "Primary contacts unavailable • Voluntarily response request"
                      : isLayer2
                        ? `${distressName} is a mutual friend of ${mutualContactName}`
                        : `Triggered moments ago · ${distance > 0 ? `${distance} km away · ~${eta} min` : "Locating..."}`}
                  </p>
                </div>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed font-sans">
                {isLayer3
                  ? "You are registered as a verified Guardian Angel. Someone nearby needs urgent assistance and no other responders have confirmed. Confirm if you can help."
                  : isLayer2
                    ? `${distressName} triggered an emergency safety alert. Since you are connected via ${mutualContactName}, you have been notified to assist nearby.`
                    : `Confirm your response to alert ${distressFirstName} and other circle guardians that you are on your way to assist.`}
              </p>

              <div className="flex gap-2.5 w-full mt-1.5">
                {(isLayer2 || isLayer3) && (
                  <button
                    onClick={handleDeclineRequest}
                    className="flex-1 bg-white hover:bg-gray-50 border border-gray-300 text-red-600 hover:text-red-700 font-bold text-xs py-3.5 rounded-xl transition active:scale-[0.98] flex justify-center items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">close</span>I cannot help
                  </button>
                )}
                <button
                  onClick={handleStartHelp}
                  className={`font-black text-xs py-3.5 rounded-xl transition active:scale-[0.98] flex justify-center items-center gap-2 uppercase tracking-wider shadow-md ${
                    isLayer3
                      ? "flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                      : isLayer2
                        ? "flex-1 bg-indigo-700 hover:bg-indigo-800 text-white"
                        : "w-full bg-red-600 hover:bg-red-700 text-white animate-pulse"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">directions_run</span>
                  {isLayer3 || isLayer2 ? "I can help" : "I am responding — I am on my way"}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Pre-Response Confirmation Dialog Modal */}
      {receiverState === "confirm" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-6 animate-scale-in border border-indigo-100">
            <div className="flex items-center gap-2.5 mb-4">
              <span
                className="material-symbols-outlined text-indigo-700 text-2xl"
                style={{ fontVariationSettings: "'FILL' 1'" }}
              >
                security
              </span>
              <h3 className="font-extrabold text-base text-gray-900">Confirm Assistance Request</h3>
            </div>

            <div className="flex flex-col gap-4 text-xs text-gray-600 leading-relaxed mb-6">
              <div className="bg-indigo-50/70 border border-indigo-100/60 rounded-xl p-3.5 flex flex-col gap-2">
                <div className="flex justify-between items-baseline font-bold text-indigo-950">
                  <span>Mutual Connection</span>
                  <span className="text-[11px] text-indigo-750">{mutualContactName}</span>
                </div>
                <div className="flex justify-between items-baseline font-bold text-indigo-950">
                  <span>Approximate Distance</span>
                  <span className="text-[11px] text-indigo-750">300m away</span>
                </div>
              </div>
              <p className="bg-gray-50 border border-gray-150 p-3 rounded-xl italic font-sans">
                "You are registered as a community helper. Someone nearby needs assistance."
              </p>
              <p className="text-[10px] text-gray-400 font-semibold leading-normal">
                By confirming, Priya Sharma and her guardians will see that you are responding. Your
                location will be updated on their map.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setReceiverState("alert")}
                className="flex-1 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition text-xs"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmRespond}
                className="flex-1 py-3 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl transition text-xs shadow-md"
              >
                Confirm & Respond
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
