import { stopSharing, updateMyLocation } from "../../services/locationService";
import { subscribeToLocations } from "../../services/mapService";
import { subscribeToSOS } from "../../services/sosService";
import { findGuardianAngels } from "../../services/guardianService";
import { getSafeSpacesWithinRadius } from "../../services/safeSpaceService";
import { getAreaScore, submitRating } from "../../services/safetyRatingService";
import { getDistance } from "../../services/guardianService";
import React, { useEffect, useRef, useState } from "react";
import { GoogleMap, Marker, InfoWindow, Circle, useJsApiLoader } from "@react-google-maps/api";
import { subscribeToNotifications } from "../../services/notificationListener";
import { markNotificationRead } from "../../services/readNotification";
import { useAuth } from "../../lib/auth";
import { getLayer1Contacts, getLayer2Candidates } from "../../services/trustService";

// Custom SVG path icons for sharp, native vector pins on Google Maps
const goldShieldIcon = {
  path: "M 0,-15 L 12,-10 L 12,0 C 12,8 0,16 0,20 C 0,16 -12,8 -12,0 L -12,-10 Z",
  fillColor: "#F59E0B", // Gold/Amber
  fillOpacity: 1.0,
  strokeColor: "#FFFFFF",
  strokeWeight: 2,
  scale: 1.2,
};

const greenBuildingIcon = {
  path: "M -10,10 L -10,-6 L 0,-12 L 10,-6 L 10,10 Z M -6,10 L -6,4 L 6,4 L 6,10 Z",
  fillColor: "#10B981", // Emerald Green
  fillOpacity: 1.0,
  strokeColor: "#FFFFFF",
  strokeWeight: 2,
  scale: 1.2,
};

const userPinIcon = {
  path: "M 0,0 C -12,-12 -15,-20 -15,-25 C -15,-33 -8,-40 0,-40 C 8,-40 15,-33 15,-25 C 15,-20 12,-12 0,0 Z",
  fillColor: "#10B981", // Green for current user
  fillOpacity: 1.0,
  strokeColor: "#FFFFFF",
  strokeWeight: 1.5,
  scale: 0.8,
};

const activeContactIcon = {
  path: "M 0,0 C -12,-12 -15,-20 -15,-25 C -15,-33 -8,-40 0,-40 C 8,-40 15,-33 15,-25 C 15,-20 12,-12 0,0 Z",
  fillColor: "#3B82F6", // Blue for active contact
  fillOpacity: 1.0,
  strokeColor: "#FFFFFF",
  strokeWeight: 1.5,
  scale: 0.8,
};

const staleContactIcon = {
  path: "M 0,0 C -12,-12 -15,-20 -15,-25 C -15,-33 -8,-40 0,-40 C 8,-40 15,-33 15,-25 C 15,-20 12,-12 0,0 Z",
  fillColor: "#9CA3AF", // Grey for stale contact
  fillOpacity: 1.0,
  strokeColor: "#FFFFFF",
  strokeWeight: 1.5,
  scale: 0.8,
};

const sosUserIcon = {
  path: "M 0,0 C -12,-12 -15,-20 -15,-25 C -15,-33 -8,-40 0,-40 C 8,-40 15,-33 15,-25 C 15,-20 12,-12 0,0 Z",
  fillColor: "#EF4444", // Red for SOS user
  fillOpacity: 1.0,
  strokeColor: "#FFFFFF",
  strokeWeight: 1.5,
  scale: 0.8,
};

const locationOffIcon = {
  path: "M 0,0 C -12,-12 -15,-20 -15,-25 C -15,-33 -8,-40 0,-40 C 8,-40 15,-33 15,-25 C 15,-20 12,-12 0,0 Z",
  fillColor: "#9CA3AF", // Gray
  fillOpacity: 1.0,
  strokeColor: "#FFFFFF",
  strokeWeight: 1.5,
  scale: 0.8,
};

const layer2Icon = {
  path: "M 0,0 C -12,-12 -15,-20 -15,-25 C -15,-33 -8,-40 0,-40 C 8,-40 15,-33 15,-25 C 15,-20 12,-12 0,0 Z",
  fillColor: "#0D9488", // Teal
  fillOpacity: 1.0,
  strokeColor: "#FFFFFF",
  strokeWeight: 1.5,
  scale: 0.8,
};

export default function Map() {
  const { user } = useAuth();
  const lastLocationWrite = useRef(0);
  const [center, setCenter] = useState({
    lat: 28.653,
    lng: 77.156,
  });

  const [users, setUsers] = useState([]);
  const [layer1Ids, setLayer1Ids] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [sosUsers, setSosUsers] = useState([]);
  const [safeSpaces, setSafeSpaces] = useState([]);
  const [guardians, setGuardians] = useState([]);

  // Safety rating states
  const [areaScore, setAreaScore] = useState(null);
  const [lastBadgeLocation, setLastBadgeLocation] = useState(null);
  const [showScorePopup, setShowScorePopup] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);

  // Rate form states
  const [newScore, setNewScore] = useState(null);
  const [newTags, setNewTags] = useState([]);
  const [ratingSuccess, setRatingSuccess] = useState(false);
  const [ratingError, setRatingError] = useState(null);

  // Selected pins details overlay
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [selectedGA, setSelectedGA] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [layer2Candidates, setLayer2Candidates] = useState([]);
  const [pulseRadius, setPulseRadius] = useState(500);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: "AIzaSyAyqOvmQjDAp7Mwi5CYUUiSNrjqd5kyuEk",
  });

  const [googlePoint, setGooglePoint] = useState(null);

  useEffect(() => {
    if (isLoaded && window.google) {
      setGooglePoint(new window.google.maps.Point(0, 5));
    }
  }, [isLoaded]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseRadius((prev) => (prev === 500 ? 530 : 500));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getRelativeTime = (timestamp) => {
    const diffInSeconds = Math.floor((Date.now() - timestamp) / 1000);
    if (diffInSeconds < 60) return "just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  // Live location tracking
  useEffect(() => {
    if (!navigator.geolocation) {
      console.log("Geolocation not supported");
      return;
    }

    let watchId;
    let isActive = true;

    const startTracking = () => {
      const isBackground = document.visibilityState === "hidden";
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          if (!isActive) return;
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          setCenter({ lat, lng });

          const sharingEnabled = localStorage.getItem("trustnet_location_sharing") !== "false";
          if (!user) return;
          if (!sharingEnabled) {
            await stopSharing(user.id);
            return;
          }

          // Throttling: 120s in background, 30s in foreground
          const intervalMs = isBackground ? 120_000 : 30_000;
          if (Date.now() - lastLocationWrite.current >= intervalMs) {
            lastLocationWrite.current = Date.now();
            await updateMyLocation(user.id, lat, lng);
          }
        },
        (error) => {
          console.log("Location error:", error);
        },
        {
          enableHighAccuracy: !isBackground,
          maximumAge: 0,
        },
      );
    };

    const handleVisibilityChange = () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = 0;
      }
      if (document.visibilityState === "visible") {
        if (isActive) startTracking();
      }
    };

    startTracking();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isActive = false;
      if (watchId) navigator.geolocation.clearWatch(watchId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getLayer1Contacts(user.id)
      .then((relationships) =>
        setLayer1Ids(
          relationships.map((relationship) =>
            relationship.userA === user.id ? relationship.userB : relationship.userA,
          ),
        ),
      )
      .catch((error) => console.error("Unable to load trusted contacts", error));
  }, [user]);

  // Listen for all users, SOS, notifications
  useEffect(() => {
    const unsubscribeLocations = subscribeToLocations((locations) => {
      setUsers(locations);
    });

    const unsubscribeSOS = subscribeToSOS((sessions) => {
      setSosUsers(sessions);
    });

    const unsubscribeNotifications = user
      ? subscribeToNotifications(user.id, (data) => setNotifications(data))
      : () => {};

    return () => {
      unsubscribeLocations();
      unsubscribeSOS();
      unsubscribeNotifications();
    };
  }, [user]);

  useEffect(() => {
    if (!user || sosUsers.length === 0) {
      setLayer2Candidates([]);
      return;
    }
    const fetchL2 = async () => {
      let allL2 = [];
      for (const su of sosUsers) {
        if (su.layerActive >= 2) {
          const l2 = await getLayer2Candidates(su.triggeredBy || su.id);
          allL2 = [...allL2, ...l2];
        }
      }
      setLayer2Candidates(allL2);
    };
    fetchL2();
  }, [user, sosUsers]);

  // Fetch Safe Spaces and Guardians dynamically based on Center
  useEffect(() => {
    const fetchMapItems = async () => {
      try {
        // Safe spaces within 2km
        const spaces = await getSafeSpacesWithinRadius(center.lat, center.lng, 2);
        setSafeSpaces(spaces);

        // Guardians within 2km
        const gas = await findGuardianAngels(center.lat, center.lng, 2000);
        setGuardians(gas);
      } catch (err) {
        console.error("Error fetching safe spaces or guardians:", err);
      }
    };

    fetchMapItems();
  }, [center]);

  // Handle Safety Rating Badge and location movement (Refresh score on moving > 150m)
  const loadBadgeScore = async (forceLocation = center) => {
    try {
      const res = await getAreaScore(forceLocation.lat, forceLocation.lng);
      setAreaScore(res);
      setLastBadgeLocation(forceLocation);
    } catch (err) {
      console.error("Error loading badge score:", err);
    }
  };

  useEffect(() => {
    if (!lastBadgeLocation) {
      loadBadgeScore(center);
    } else {
      const dist = getDistance(
        center.lat,
        center.lng,
        lastBadgeLocation.lat,
        lastBadgeLocation.lng,
      );
      if (dist > 150) {
        loadBadgeScore(center);
      }
    }
  }, [center, lastBadgeLocation]);

  // Handle Safety Rating Submission
  const handleRatingSubmit = async () => {
    if (newScore === null) return;
    setRatingError(null);
    try {
      if (!user) throw new Error("Sign in to submit a rating");
      await submitRating(user.id, center.lat, center.lng, newScore, newTags);

      setRatingSuccess(true);
      setShowRateModal(false);
      setShowScorePopup(false);

      // Refresh badge immediately
      await loadBadgeScore(center);

      setTimeout(() => {
        setRatingSuccess(false);
        setNewScore(null);
        setNewTags([]);
      }, 2000);
    } catch (err) {
      setRatingError(err.message || "Submission failed");
    }
  };

  const toggleTag = (tag) => {
    setNewTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const tagsPool = ["Poor lighting", "Isolated", "Well lit", "Crowded", "Police presence"];

  if (!isLoaded) {
    return (
      <div className="w-full h-[500px] bg-gray-100 flex items-center justify-center font-bold text-gray-500 animate-pulse rounded-2xl border">
        Loading Maps...
      </div>
    );
  }

  // Determine Badge Color
  const getBadgeBgColor = () => {
    if (!areaScore || areaScore.ratingCount < 3) return "bg-gray-400";
    if (areaScore.score >= 7) return "bg-green-600";
    if (areaScore.score >= 4) return "bg-amber-500";
    return "bg-red-600";
  };

  return (
    <div style={{ position: "relative" }} className="w-full rounded-2xl overflow-hidden shadow-md">
      <GoogleMap
        center={center}
        zoom={15}
        mapContainerStyle={{
          width: "100%",
          height: "500px",
        }}
      >
        {/* Current user marker */}
        <Marker
          position={center}
          label={{ text: "You", color: "#065f46", fontWeight: "700" }}
          icon={googlePoint ? { ...userPinIcon, labelOrigin: googlePoint } : userPinIcon}
        />

        {/* Normal User Markers */}
        {users
          .filter(
            (u) =>
              u.id !== user?.id &&
              layer1Ids.includes(u.id) &&
              typeof u.latitude === "number" &&
              typeof u.longitude === "number",
          )
          .map((u) => {
            const isSharingOff = u.sharingEnabled === false;
            const lastActive = u.timestamp?.toDate
              ? u.timestamp.toDate().getTime()
              : u.timestamp?.seconds
                ? u.timestamp.seconds * 1000
                : Date.now();
            const isStale = Date.now() - lastActive > 3_600_000;
            const baseIcon = isSharingOff
              ? locationOffIcon
              : isStale
                ? staleContactIcon
                : activeContactIcon;
            return (
              <Marker
                key={u.id}
                position={{
                  lat: u.latitude,
                  lng: u.longitude,
                }}
                label={{
                  text: u.name || "Contact",
                  color: isSharingOff ? "#6B7280" : isStale ? "#4b5563" : "#1d4ed8",
                  fontWeight: "700",
                }}
                icon={googlePoint ? { ...baseIcon, labelOrigin: googlePoint } : baseIcon}
                onClick={() => {
                  setSelectedContact({ ...u, isL2: false, isSharingOff });
                  setSelectedGA(null);
                  setSelectedSpace(null);
                }}
              />
            );
          })}

        {/* Layer 2 Candidates (Active SOS only) */}
        {users
          .filter(
            (u) =>
              layer2Candidates.some((c) => c.uid === u.id) &&
              typeof u.latitude === "number" &&
              typeof u.longitude === "number",
          )
          .map((u) => (
            <Marker
              key={`l2-${u.id}`}
              position={{ lat: u.latitude, lng: u.longitude }}
              label={{ text: u.name || "L2 Candidate", color: "#0D9488", fontWeight: "700" }}
              icon={googlePoint ? { ...layer2Icon, labelOrigin: googlePoint } : layer2Icon}
              onClick={() => {
                setSelectedContact({ ...u, isL2: true, isSharingOff: u.sharingEnabled === false });
                setSelectedGA(null);
                setSelectedSpace(null);
              }}
            />
          ))}

        {/* Contact InfoWindow */}
        {selectedContact && (
          <InfoWindow
            position={{ lat: selectedContact.latitude, lng: selectedContact.longitude }}
            onCloseClick={() => setSelectedContact(null)}
            options={{ pixelOffset: googlePoint ? new window.google.maps.Size(0, -30) : undefined }}
          >
            <div className="p-1 min-w-[140px]">
              <h3 className="font-bold text-gray-900 text-sm">{selectedContact.name}</h3>
              <p className="text-[11px] text-gray-500 font-semibold mb-1">
                {selectedContact.isL2 ? "Layer 2 Candidate" : "Layer 1 Contact"}
              </p>
              <p className="text-[10px] text-gray-600 mt-1">
                Distance:{" "}
                {Math.round(
                  getDistance(
                    center.lat,
                    center.lng,
                    selectedContact.latitude,
                    selectedContact.longitude,
                  ),
                )}
                m
              </p>
              <p className="text-[10px] text-gray-600">
                Last Update:{" "}
                {getRelativeTime(
                  selectedContact.timestamp?.toDate
                    ? selectedContact.timestamp.toDate().getTime()
                    : selectedContact.timestamp?.seconds
                      ? selectedContact.timestamp.seconds * 1000
                      : Date.now(),
                )}
              </p>
              {selectedContact.isSharingOff ? (
                <p className="text-[10px] text-red-600 font-bold mt-1">Location sharing off</p>
              ) : (
                <p className="text-[10px] text-green-600 font-bold mt-1">Location sharing on</p>
              )}
            </div>
          </InfoWindow>
        )}

        {/* SOS User Markers */}
        {sosUsers
          .filter((user) => typeof user.latitude === "number" && typeof user.longitude === "number")
          .map((user) => (
            <Marker
              key={`sos-${user.id}`}
              position={{
                lat: user.latitude,
                lng: user.longitude,
              }}
              label={{
                text: "SOS!",
                color: "#991b1b",
                fontWeight: "800",
              }}
              icon={googlePoint ? { ...sosUserIcon, labelOrigin: googlePoint } : sosUserIcon}
            />
          ))}

        {/* Coverage Radius Circles for SOS Users */}
        {sosUsers
          .filter((su) => typeof su.latitude === "number" && typeof su.longitude === "number")
          .map((su) => {
            const responder = su.responderUID ? users.find((u) => u.id === su.responderUID) : null;
            return (
              <React.Fragment key={`circles-${su.id}`}>
                {/* Circle around distressed user */}
                <Circle
                  center={{ lat: su.latitude, lng: su.longitude }}
                  radius={pulseRadius}
                  options={{
                    strokeColor:
                      su.layerActive >= 3 ? "#f59e0b" : su.layerActive >= 2 ? "#0d9488" : "#8b5cf6",
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor:
                      su.layerActive >= 3 ? "#f59e0b" : su.layerActive >= 2 ? "#0d9488" : "#8b5cf6",
                    fillOpacity: 0.05,
                    clickable: false,
                  }}
                />

                {/* Circle around responder if active */}
                {responder &&
                  typeof responder.latitude === "number" &&
                  typeof responder.longitude === "number" && (
                    <Circle
                      center={{ lat: responder.latitude, lng: responder.longitude }}
                      radius={pulseRadius}
                      options={{
                        strokeColor: su.layerActive >= 3 ? "#f59e0b" : "#0d9488",
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                        fillColor: su.layerActive >= 3 ? "#f59e0b" : "#0d9488",
                        fillOpacity: 0.05,
                        clickable: false,
                      }}
                    />
                  )}
              </React.Fragment>
            );
          })}

        {/* Safe Spaces Green Building Markers */}
        {safeSpaces.map((space) => (
          <Marker
            key={`space-${space.id}`}
            position={{
              lat: space.latitude,
              lng: space.longitude,
            }}
            icon={greenBuildingIcon}
            onClick={() => {
              setSelectedSpace(space);
              setSelectedGA(null);
            }}
          />
        ))}

        {/* Guardian Angels Gold Shield Markers */}
        {guardians.map((ga) => (
          <Marker
            key={`ga-${ga.uid}`}
            position={{
              lat: ga.latitude,
              lng: ga.longitude,
            }}
            icon={goldShieldIcon}
            onClick={() => {
              setSelectedGA(ga);
              setSelectedSpace(null);
            }}
          />
        ))}
      </GoogleMap>

      {/* Floating Safety Badge (Corner of Map) */}
      <div style={{ position: "absolute", top: "15px", left: "15px", zIndex: 900 }}>
        <button
          onClick={() => setShowScorePopup(true)}
          className={`w-14 h-14 rounded-full border-2 border-white shadow-xl text-white font-extrabold flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer ${getBadgeBgColor()}`}
        >
          <span className="text-sm font-black leading-none">
            {areaScore && areaScore.ratingCount >= 3 ? areaScore.score.toFixed(1) : "?"}
          </span>
          <span className="text-[7px] uppercase font-bold tracking-wide mt-0.5">Safety</span>
        </button>
      </div>

      {/* Rating success confirmation toast */}
      {ratingSuccess && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
          }}
          className="bg-emerald-600 text-white font-bold px-5 py-3 rounded-full shadow-lg text-xs tracking-wide animate-bounce"
        >
          Your rating helps keep your community safe.
        </div>
      )}

      {/* Badge Proximity Popup Info */}
      {showScorePopup && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 950 }}
          className="bg-black/35 flex items-center justify-center p-4"
        >
          <div
            className="bg-white rounded-3xl p-5 shadow-2xl max-w-xs w-full flex flex-col gap-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-extrabold text-sm text-gray-900 tracking-tight">
              Area Safety Profile
            </h3>

            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-black ${getBadgeBgColor()}`}
              >
                {areaScore && areaScore.ratingCount >= 3 ? areaScore.score.toFixed(1) : "?"}
              </div>
              <div className="flex-grow">
                <p className="text-xs font-bold text-gray-800">
                  {areaScore && areaScore.ratingCount >= 3 ? "Safety Index" : "Insufficient Data"}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {areaScore && areaScore.ratingCount >= 3
                    ? `${areaScore.ratingCount} crowdsourced ratings`
                    : "No ratings logged within 150m"}
                </p>
              </div>
            </div>

            {/* Tooltip info if empty */}
            {(!areaScore || areaScore.ratingCount < 3) && (
              <p className="text-[10px] text-gray-500 italic leading-relaxed">
                No data yet for this area — be the first to rate it.
              </p>
            )}

            {/* Top tags list */}
            {areaScore &&
              areaScore.ratingCount >= 3 &&
              areaScore.topTags &&
              areaScore.topTags.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">
                    Top features reported
                  </span>
                  <div className="flex gap-1.5 flex-wrap">
                    {areaScore.topTags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] font-bold bg-gray-100 text-gray-655 px-2 py-0.5 rounded-full"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            <button
              onClick={() => {
                setShowRateModal(true);
                setShowScorePopup(false);
              }}
              className="w-full bg-[#0d631b] hover:bg-[#0a5215] text-white py-3 rounded-xl font-bold text-xs transition active:scale-[0.98] shadow-sm"
            >
              Rate this Area
            </button>
            <button
              onClick={() => setShowScorePopup(false)}
              className="text-[11px] text-gray-400 font-semibold mt-1"
            >
              Close Info
            </button>
          </div>
        </div>
      )}

      {/* Rate area modal form */}
      {showRateModal && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 960 }}
          className="bg-black/40 flex items-center justify-center p-4"
        >
          <div
            className="bg-white rounded-3xl p-5 shadow-2xl max-w-sm w-full flex flex-col gap-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-extrabold text-sm text-gray-900">Rate this Area</h3>
            <p className="text-xs text-gray-550 leading-relaxed -mt-2">
              Rate your current location. Please be honest to support community helpers.
            </p>

            {ratingError && (
              <div className="text-[10px] font-bold text-red-600 bg-red-50 p-2.5 rounded-xl">
                {ratingError}
              </div>
            )}

            {/* 1-10 selector grid */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">
                Select Safety Score (1-10)
              </span>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                  <button
                    key={score}
                    onClick={() => setNewScore(score)}
                    className={`h-9 rounded-lg font-black text-xs transition ${
                      newScore === score
                        ? "bg-[#0d631b] text-white shadow-md scale-105"
                        : "bg-gray-100 hover:bg-gray-150 text-gray-700"
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags checkboxes */}
            <div className="flex flex-col gap-1.5 mt-1">
              <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">
                Features tags (Optional)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {tagsPool.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition ${
                      newTags.includes(tag)
                        ? "bg-[#0d631b]/10 text-[#0d631b] border-[#0d631b]"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleRatingSubmit}
              disabled={newScore === null}
              className={`w-full py-3.5 rounded-xl font-bold text-sm transition active:scale-[0.98] mt-2 ${
                newScore !== null
                  ? "bg-[#0d631b] hover:bg-[#0a5215] text-white shadow"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              Submit Rating
            </button>
            <button
              onClick={() => {
                setShowRateModal(false);
                setNewScore(null);
                setNewTags([]);
                setRatingError(null);
              }}
              className="text-xs text-gray-400 font-semibold text-center mt-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Selected Safe Space Detail Popup */}
      {selectedSpace && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 910 }}
          className="bg-black/35 flex items-end justify-center p-4"
          onClick={() => setSelectedSpace(null)}
        >
          <div
            className="bg-white rounded-t-3xl rounded-b-xl p-5 shadow-2xl w-full max-w-sm flex flex-col gap-3.5 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <span
                  className="material-symbols-outlined text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  store
                </span>
              </div>
              <div className="flex-grow">
                <h3 className="font-extrabold text-sm text-gray-900 leading-none">
                  {selectedSpace.name}
                </h3>
                <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full inline-block mt-1 font-semibold font-sans">
                  {selectedSpace.type.replace("_", " ")} • {selectedSpace.distance}m away
                </span>
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-start gap-2">
              <span
                className="material-symbols-outlined text-emerald-600 text-base shrink-0 mt-0.5"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified_user
              </span>
              <p className="text-[10px] text-emerald-800 font-bold leading-normal">
                TrustNet Safe Space — you can walk in and ask for help here.
              </p>
            </div>
            <p className="text-[11px] text-gray-500 leading-normal">{selectedSpace.address}</p>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${selectedSpace.latitude},${selectedSpace.longitude}&travelmode=walking`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-xs transition shadow"
            >
              <span className="material-symbols-outlined text-base">directions_walk</span>
              Get Walking Directions
            </a>
            <button
              onClick={() => setSelectedSpace(null)}
              className="text-xs text-gray-400 font-semibold mt-1"
            >
              Close Proximity Info
            </button>
          </div>
        </div>
      )}

      {/* Selected GA Detail Popup */}
      {selectedGA && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 910 }}
          className="bg-black/35 flex items-end justify-center p-4"
          onClick={() => setSelectedGA(null)}
        >
          <div
            className="bg-white rounded-t-3xl rounded-b-xl p-5 shadow-2xl w-full max-w-sm flex flex-col gap-3.5 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                <span
                  className="material-symbols-outlined text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  security
                </span>
              </div>
              <div className="flex-grow">
                <h3 className="font-extrabold text-sm text-gray-900 leading-none">
                  {selectedGA.name}
                </h3>
                <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full inline-block mt-1 font-semibold font-sans">
                  Verified Guardian Angel • {Math.round(selectedGA.distance)}m away
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center bg-gray-50 border border-gray-150 rounded-xl p-3">
              <div className="text-center flex-1 border-r border-gray-200">
                <p className="text-[9px] uppercase font-bold text-gray-400">Rating</p>
                <p className="text-base font-black text-amber-600 mt-0.5">
                  ⭐ {selectedGA.rating.toFixed(1)}
                </p>
              </div>
              <div className="text-center flex-1">
                <p className="text-[9px] uppercase font-bold text-gray-400">Responses</p>
                <p className="text-base font-black text-gray-800 mt-0.5">
                  {selectedGA.responseCount} times
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedGA(null)}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition shadow"
            >
              Close Info
            </button>
          </div>
        </div>
      )}

      {/* Notification Panel overlay */}
      {notifications.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: "15px",
            right: "15px",
            width: "280px",
            maxHeight: "180px",
            overflowY: "auto",
            background: "#ffffff",
            borderRadius: "16px",
            padding: "12px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            border: "1px solid #e5e7eb",
            zIndex: 900,
          }}
        >
          <h4 className="text-xs font-black text-gray-800 flex items-center gap-1 mb-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            🔔 Emergency Alerts
          </h4>
          <div className="flex flex-col gap-2">
            {notifications.map((item) => (
              <div
                key={item.id}
                onClick={async () => {
                  await markNotificationRead(item.id);
                }}
                className="bg-red-50 hover:bg-red-100 border border-red-100 rounded-xl p-2 cursor-pointer transition active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-[10px] text-red-800 font-extrabold">{item.sender}</strong>
                  <span className="text-[8px] text-red-500 font-bold uppercase">Mark Read</span>
                </div>
                <p className="text-[10px] text-red-700 mt-0.5 leading-normal">{item.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
