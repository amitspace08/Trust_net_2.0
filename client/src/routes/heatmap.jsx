import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../lib/auth";

import { UserAvatar } from "../components/ui/UserAvatar";

import { useLayer1Contacts } from "../hooks/useContacts";
import { getAreaScore, submitRating } from "../services/safetyRatingService";
import { getNearbyReports, submitReport } from "../services/reportService";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export const Route = createFileRoute("/heatmap")({
  validateSearch: (search) => {
    return {
      targetLat: search.targetLat ? Number(search.targetLat) : undefined,
      targetLng: search.targetLng ? Number(search.targetLng) : undefined,
      targetName: search.targetName || undefined,
      targetAvatar: search.targetAvatar || undefined,
      targetPhone: search.targetPhone || undefined,
      targetRelation: search.targetRelation || undefined,
    };
  },
  head: () => ({
    meta: [{ title: "TrustNet - Heatmap" }],
  }),
  component: HeatmapPage,
});

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    // Slight delay ensures DOM has painted the container's final dimensions
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

// Fly map to user's real location on first GPS fix
function FlyTo({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 15, { animate: true, duration: 1.2 });
  }, [center, map]);
  return null;
}

// Custom green "You" icon
const youIcon = L.divIcon({
  className: "",
  html: `<div style="width:28px;height:28px;border-radius:50%;background:#0d631b;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);color:white;font-size:13px;font-weight:bold">U</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function HeatmapPage() {
  const { user } = useAuth();
  const avatarUrl = user?.avatar || user?.profile_photo || "";
  const navigate = useNavigate();
  const search = Route.useSearch();
  const contacts = useLayer1Contacts();
  
  const [selectedContact, setSelectedContact] = useState(() => {
    if (search.targetLat && search.targetLng) {
      return {
        id: "target_external",
        name: search.targetName || "Target Location",
        avatar: search.targetAvatar || "",
        phone: search.targetPhone || "",
        relation: search.targetRelation || "Distressed User",
        latitude: search.targetLat,
        longitude: search.targetLng,
        shareLocation: true,
        online: true,
      };
    }
    return null;
  });

  const [isNightMode, setIsNightMode] = useState(false);

  // Real GPS location
  const [myLocation, setMyLocation] = useState(null);
  const [locationError, setLocationError] = useState(false);
  const [mapCenter, setMapCenter] = useState(null);
  const [areaName, setAreaName] = useState("Your Current Area");

  // Derived lat/lng (fall back to Delhi if GPS not ready)
  const LAT = myLocation?.lat ?? 28.6139;
  const LNG = myLocation?.lng ?? 77.209;

  const [reports, setReports] = useState([]);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [showSubmitReportModal, setShowSubmitReportModal] = useState(false);
  const [reportType, setReportType] = useState("other");
  const [reportNote, setReportNote] = useState("");
  const [reportSuccess, setReportSuccess] = useState(false);

  // Safety Rating States
  const [avgScore, setAvgScore] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [topTags, setTopTags] = useState([]);

  const [showScorePopup, setShowScorePopup] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [ratingSuccess, setRatingSuccess] = useState(false);
  const [newScore, setNewScore] = useState(null);
  const [newTags, setNewTags] = useState([]);

  // Maps and Routing States
  const [routePolyline, setRoutePolyline] = useState(null);
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [isRouting, setIsRouting] = useState(false);

  const calculateRoute = async () => {
    setIsRouting(true);
    try {
      if (!myLocation) {
        alert("Waiting for GPS location...");
        setIsRouting(false);
        return;
      }
      if (!selectedContact || !selectedContact.latitude || !selectedContact.longitude) {
        alert("Please tap on a friend's profile picture pin to select them first.");
        setIsRouting(false);
        return;
      }
      const origin = myLocation;
      const dest = { lat: selectedContact.latitude, lng: selectedContact.longitude };
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/foot/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`,
      );
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        // geojson is [lng, lat], polyline needs [lat, lng]
        const latLngs = route.geometry.coordinates.map((coord) => [coord[1], coord[0]]);
        setRoutePolyline(latLngs);
        setDistance((route.distance / 1000).toFixed(2) + " km");
        setDuration(Math.ceil(route.duration / 60) + " mins");
      } else {
        alert("Could not calculate a safe route.");
      }
    } catch (error) {
      console.error("Error calculating route:", error);
      alert(
        `Could not calculate a safe route. Reason: ${error?.message || error?.code || JSON.stringify(error)}`,
      );
    }
    setIsRouting(false);
  };

  useEffect(() => {
    if (search.targetLat && search.targetLng && myLocation && !routePolyline && !isRouting) {
      calculateRoute();
    }
  }, [search.targetLat, search.targetLng, myLocation, routePolyline]);

  const TYPES = [
    { id: "suspicious", icon: "visibility", label: "Suspicious activity" },
    { id: "harassment", icon: "report", label: "Harassment" },
    { id: "theft", icon: "shopping_bag", label: "Theft" },
    { id: "unsafe", icon: "warning", label: "Unsafe area" },
    { id: "accident", icon: "local_hospital", label: "Accident" },
    { id: "other", icon: "more_horiz", label: "Other" },
  ];

  const handleRatingSubmit = async () => {
    if (newScore === null || !user) return;
    try {
      await submitRating(user.id, LAT, LNG, newScore, newTags);
      setRatingSuccess(true);
      setShowRateModal(false);
      setShowScorePopup(false);

      fetchAreaDetails();

      setTimeout(() => {
        setRatingSuccess(false);
        setNewScore(null);
        setNewTags([]);
      }, 2000);
    } catch (err) {
      alert(err.message || "Failed to submit rating");
    }
  };

  const handleReportSubmit = async () => {
    if (!user) return;
    try {
      await submitReport(user.id, LAT, LNG, reportType, "Downtown Transit Hub", reportNote);
      setReportSuccess(true);
      setShowSubmitReportModal(false);

      fetchAreaDetails();

      setTimeout(() => {
        setReportSuccess(false);
        setReportType("other");
        setReportNote("");
      }, 2000);
    } catch (err) {
      alert(err.message || "Failed to submit report");
    }
  };

  const fetchAreaDetails = async () => {
    try {
      const scoreData = await getAreaScore(LAT, LNG);
      if (scoreData) {
        setAvgScore(scoreData.score);
        setRatingCount(scoreData.ratingCount);
        setTopTags(scoreData.topTags);
      }
      const nearbyReports = await getNearbyReports(LAT, LNG, 1000);
      setReports(nearbyReports);
    } catch (err) {
      console.error("Failed to fetch area details", err);
    }
  };

  useEffect(() => {
    fetchAreaDetails();
  }, []);

  // ── Watch real GPS location ──
  useEffect(() => {
    if (!navigator.geolocation) { setLocationError(true); return; }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLocation(coords);
        setMapCenter((prev) => prev || [coords.lat, coords.lng]);
      },
      () => setLocationError(true),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // ── Reverse geocode area name from real GPS ──
  useEffect(() => {
    if (!myLocation) return;
    const { lat, lng } = myLocation;
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
      .then((r) => r.json())
      .then((data) => {
        const addr = data.address || {};
        setAreaName(addr.road || addr.suburb || addr.neighbourhood || addr.city_district || addr.city || "Your Area");
      })
      .catch(() => {});
  }, [myLocation?.lat?.toFixed(3), myLocation?.lng?.toFixed(3)]);

  // Map coordinates percentage-based simulation positions
  const PIN_POSITIONS = {
    mom: { top: "32%", left: "45%" },
    riya: { top: "50%", left: "55%" },
    arjun: { top: "65%", left: "30%" },
    default: { top: "42%", left: "62%" }, // Fallback for newly added contacts
  };

  const getPinStyle = (id, index) => {
    return (
      PIN_POSITIONS[id] || {
        top: `${20 + ((index * 12) % 60)}%`,
        left: `${25 + ((index * 17) % 60)}%`,
      }
    );
  };

  return (
    <div className="w-full min-h-screen relative flex flex-col md:flex-row pb-24 md:pb-0 bg-[#faf9fc]">
      {/* Map Content Canvas */}
      <main className="flex-grow relative w-full  h-[calc(100vh-4rem)] md:h-screen bg-gray-200 overflow-hidden flex flex-col">
        {/* Map Background */}
        <div
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-0"
          onClick={() => setSelectedContact(null)}
        >
          <MapContainer
            center={[LAT, LNG]}
            zoom={15}
            zoomControl={false}
            style={{ height: "100%", width: "100%" }}
            className={`transition-filter duration-500 ${isNightMode ? "brightness-75 contrast-125 hue-rotate-180 invert" : ""}`}
          >
            <MapResizer />
            {mapCenter && <FlyTo center={mapCenter} />}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* ── YOUR real location ── */}
            {myLocation && (
              <>
                <Marker position={[myLocation.lat, myLocation.lng]} icon={youIcon}>
                  <Popup>
                    <div className="font-bold text-xs text-green-700">📍 You are here</div>
                    <div className="text-[10px] text-gray-500">{areaName}</div>
                  </Popup>
                </Marker>
                <Circle
                  center={[myLocation.lat, myLocation.lng]}
                  radius={80}
                  pathOptions={{ color: "#0d631b", fillColor: "#0d631b", fillOpacity: 0.08, weight: 2 }}
                />
              </>
            )}

            {/* ── Contacts real GPS locations ── */}
            {[...contacts, ...(selectedContact?.id === "target_external" ? [selectedContact] : [])].map((c) => {
              if (!c.shareLocation || !c.latitude || !c.longitude) return null;
              
              const avatarIcon = L.divIcon({
                className: "custom-avatar-marker",
                html: `<div style="width:36px;height:36px;border-radius:50%;overflow:hidden;border:3px solid ${c.id === 'target_external' ? '#ef4444' : '#0d631b'};box-shadow:0 3px 6px rgba(0,0,0,0.4);background:white;display:flex;align-items:center;justify-content:center;font-weight:bold;color:#333;"><img src="${c.avatar || ''}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'" />${!c.avatar ? c.name.charAt(0) : ''}</div>`,
                iconSize: [36, 36],
                iconAnchor: [18, 18],
              });

              return (
                <Marker
                  key={c.id}
                  position={[c.latitude, c.longitude]}
                  icon={avatarIcon}
                  eventHandlers={{
                    click: () => setSelectedContact(c),
                  }}
                >
                  <Popup>
                    <div className="font-bold text-xs">{c.name}</div>
                    <div className="text-[10px] text-gray-500">
                      {c.relation} {c.online ? "· Online" : "· Offline"}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Reports Markers */}
            {reports.map((rep) => {
              return (
                <Marker key={rep.id} position={[rep.latitude, rep.longitude]}>
                  <Popup>
                    <div className="text-xs font-bold">
                      {TYPES.find((t) => t.id === rep.type)?.label || rep.type}
                    </div>
                    {rep.note && <div className="text-[10px] text-gray-500">{rep.note}</div>}
                  </Popup>
                </Marker>
              );
            })}

            {/* ── Incident heat-ring clusters ── */}
            {(() => {
              const clusters = [];
              for (const rep of reports) {
                let placed = false;
                for (const cl of clusters) {
                  const d = Math.sqrt((rep.latitude - cl.lat) ** 2 + (rep.longitude - cl.lng) ** 2);
                  if (d < 0.002) { cl.count++; placed = true; break; }
                }
                if (!placed) clusters.push({ lat: rep.latitude, lng: rep.longitude, count: 1 });
              }
              return clusters.map((cl, i) => (
                <Circle key={i} center={[cl.lat, cl.lng]} radius={80 + cl.count * 40}
                  pathOptions={{
                    color: cl.count >= 3 ? "#dc2626" : cl.count >= 2 ? "#f59e0b" : "#fca5a5",
                    fillColor: cl.count >= 3 ? "#dc2626" : cl.count >= 2 ? "#f59e0b" : "#fca5a5",
                    fillOpacity: 0.13, weight: 1,
                  }} />
              ));
            })()}

            {/* Directions Renderer */}
            {routePolyline && (
              <Polyline positions={routePolyline} color="#0d631b" weight={5} opacity={0.8} />
            )}
          </MapContainer>
        </div>

        {/* Heatmap Overlay (simulated via gradient overlay) */}
        <div
          className={`absolute inset-0 pointer-events-none z-10 mix-blend-multiply transition-opacity duration-300 ${
            isNightMode ? "bg-indigo-950/20" : "bg-transparent"
          }`}
        />

        {/* Controls Overlay */}
        <div className="absolute top-4 left-4 right-4 z-20 flex flex-col gap-3 pointer-events-none">
          <div className="flex justify-between items-start">
            {/* Day/Night Selector */}
            <div className="bg-white rounded-full p-1 shadow-md flex items-center border border-gray-200 pointer-events-auto">
              <button
                onClick={() => setIsNightMode(false)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition ${
                  !isNightMode ? "bg-[#0d631b]/10 text-[#0d631b]" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">light_mode</span>
                Day
              </button>
              <button
                onClick={() => setIsNightMode(true)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition ${
                  isNightMode ? "bg-[#0d631b]/10 text-[#0d631b]" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">dark_mode</span>
                Night
              </button>
            </div>

            <div className="flex flex-col items-end gap-2 pointer-events-auto">
              {/* GPS Status */}
              {myLocation && (
                <div className="bg-white/95 backdrop-blur rounded-full px-3 py-1 shadow border border-gray-200 text-[10px] font-bold text-green-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Live GPS Active
                </div>
              )}
              {locationError && (
                <div className="bg-red-50 border border-red-200 rounded-full px-3 py-1 shadow text-[10px] font-bold text-red-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs">location_off</span>
                  GPS Unavailable
                </div>
              )}

              {/* Floating Safety Score Badge */}
            <button
              id="safety-score-badge"
              onClick={() => setShowScorePopup(true)}
              className={`w-14 h-14 rounded-full flex flex-col items-center justify-center text-white font-extrabold shadow-lg pointer-events-auto transition hover:scale-105 active:scale-95 border-2 border-white cursor-pointer ${
                avgScore >= 7
                  ? "bg-green-600"
                  : avgScore >= 4
                    ? "bg-amber-500"
                    : avgScore > 0
                      ? "bg-red-600"
                      : "bg-gray-400"
              }`}
            >
              <span className="text-sm font-black">
                {avgScore > 0 ? avgScore.toFixed(1) : "N/A"}
              </span>
              <span className="text-[7px] uppercase font-bold tracking-wider -mt-0.5">Safety</span>
            </button>
            </div>
          </div>

          {/* Legend */}
          <div className="self-end bg-white/95 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-md border border-gray-200 flex items-center gap-3 pointer-events-auto">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-[10px] text-gray-600 font-semibold">Safe</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div>
              <span className="text-[10px] text-gray-600 font-semibold">Caution</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-[10px] text-gray-600 font-semibold">Avoid</span>
            </div>
          </div>
        </div>


        {/* Dynamic Bottom Detail Panel (Persistent/Dynamic Sheet) */}
        <div className="absolute bottom-4 left-4 right-4 z-30 bg-white rounded-2xl shadow-xl border border-gray-200 p-5 flex flex-col gap-4 max-w-md mx-auto pointer-events-auto">
          {selectedContact ? (
            // Contact Detail screen UI
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3.5">
                  <div className="relative">
                    <UserAvatar
                      name={selectedContact.name}
                      avatarUrl={selectedContact.avatar}
                      sizeClassName="w-12 h-12 text-base font-semibold"
                      className={`border-2 ${
                        selectedContact.shareLocation
                          ? "border-[#0d631b]/30"
                          : "border-gray-200 grayscale"
                      }`}
                    />

                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border border-white ${
                        selectedContact.online ? "bg-green-500" : "bg-gray-400"
                      }`}
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                      {selectedContact.name}
                      <span className="text-[10px] text-gray-500 font-normal bg-gray-50 px-2 py-0.5 rounded">
                        {selectedContact.relation}
                      </span>
                    </h3>
                    <p className="text-xs text-gray-500">{selectedContact.phone}</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedContact(null)}
                  className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <hr className="border-gray-100" />

              {selectedContact.shareLocation ? (
                // Location details if sharing is ON
                <div className="grid grid-cols-2 gap-4 my-1">
                  <div className="bg-gray-50/50 p-2.5 rounded-xl border border-gray-100">
                    <span className="text-[9px] text-gray-400 uppercase tracking-wider block font-semibold">
                      Last Update Time
                    </span>
                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-sm text-gray-400">
                        schedule
                      </span>
                      {selectedContact.lastUpdated}
                    </span>
                  </div>
                  <div className="bg-gray-50/50 p-2.5 rounded-xl border border-gray-100">
                    <span className="text-[9px] text-gray-400 uppercase tracking-wider block font-semibold">
                      Distance From You
                    </span>
                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-sm text-[#0d631b]">
                        distance
                      </span>
                      {selectedContact.distance}
                    </span>
                  </div>
                </div>
              ) : (
                // Warning if location sharing is OFF
                <div className="bg-red-50/60 border border-red-100 rounded-xl p-3 flex gap-2.5 items-start my-1">
                  <span className="material-symbols-outlined text-red-500 text-lg mt-0.5">
                    location_off
                  </span>
                  <div>
                    <h4 className="font-bold text-xs text-red-800">Location sharing off</h4>
                    <p className="text-[10px] text-red-800/80 leading-relaxed mt-0.5">
                      This contact has disabled location sharing. Map pin indicates last known
                      position from {selectedContact.lastUpdated} ago.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-1">
                <a
                  href={`tel:${selectedContact.phone}`}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition flex justify-center items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">call</span>
                  Call
                </a>
                <button
                  onClick={calculateRoute}
                  disabled={isRouting}
                  className="flex-1 py-2 bg-[#0d631b] hover:bg-[#0a5215] text-white text-xs font-semibold rounded-xl transition flex justify-center items-center gap-1.5 disabled:opacity-50"
                >
                  {isRouting ? (
                    <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                  ) : (
                    <span className="material-symbols-outlined text-sm">directions_walk</span>
                  )}
                  {isRouting ? "Routing..." : "Route"}
                </button>
              </div>

              {/* Show Route Distance and Duration if calculated */}
              {routePolyline && distance && duration && (
                <div className="flex items-center justify-between bg-green-50 text-green-800 border border-green-200 rounded-xl px-3 py-2 mt-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <span className="material-symbols-outlined text-sm">directions_walk</span>
                    {distance}
                  </div>
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    {duration}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Default Area Detail screen
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <h2 className="font-bold text-base text-gray-900">{areaName}</h2>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-xs">distance</span>
                    {myLocation ? `Your Location (${myLocation.lat.toFixed(4)}, ${myLocation.lng.toFixed(4)})` : "GPS Acquiring..."}
                  </p>
                </div>
                <div
                  className={`px-3 py-1 rounded-xl font-bold text-xs flex items-center gap-1 shadow-sm ${
                    avgScore >= 7
                      ? "bg-green-50 text-green-700"
                      : avgScore >= 4
                        ? "bg-amber-50 text-amber-600"
                        : avgScore > 0
                          ? "bg-red-50 text-red-600"
                          : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <span
                    className="material-symbols-outlined text-xs"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    warning
                  </span>
                  {avgScore > 0 ? avgScore.toFixed(1) : "N/A"}
                </div>
              </div>

              {/* Crowd Reports Chips */}
              <div className="flex flex-wrap gap-1.5 my-1">
                {topTags.map((tag) => (
                  <div
                    key={tag}
                    className="bg-gray-100 px-2.5 py-1 rounded-full text-[10px] text-gray-600 font-semibold flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">info</span>{" "}
                    {tag === "Welllit" ? "Well-lit" : tag}
                  </div>
                ))}
                {reports.slice(0, 2).map((rep) => {
                  const typeItem = TYPES.find((t) => t.id === rep.type) || {
                    icon: "report",
                    label: rep.type,
                  };
                  return (
                    <div
                      key={rep.id}
                      className="bg-red-50 text-red-700 px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1 border border-red-100"
                    >
                      <span
                        className="material-symbols-outlined text-xs"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {typeItem.icon}
                      </span>
                      {typeItem.label}
                    </div>
                  );
                })}
                {reports.length > 2 && (
                  <button
                    onClick={() => setShowReportsModal(true)}
                    className="text-[10px] text-[#0d631b] hover:text-[#0a5215] font-semibold self-center ml-1 underline cursor-pointer"
                  >
                    View {reports.length} reports
                  </button>
                )}
                {reports.length <= 2 && reports.length > 0 && (
                  <button
                    onClick={() => setShowReportsModal(true)}
                    className="text-[10px] text-[#0d631b] hover:text-[#0a5215] font-semibold self-center ml-1 underline cursor-pointer"
                  >
                    View details
                  </button>
                )}
              </div>

              <div className="flex gap-2.5 mt-2">
                <button
                  onClick={() => setShowRateModal(true)}
                  className="flex-1 border border-[#0d631b] hover:bg-green-50 text-[#0d631b] font-bold text-[10px] py-2 rounded-xl transition flex justify-center items-center gap-1 shadow-sm"
                >
                  <span className="material-symbols-outlined text-xs">star</span>
                  Rate
                </button>
                <button
                  onClick={() => setShowSubmitReportModal(true)}
                  className="flex-1 border border-red-600 hover:bg-red-50 text-red-600 font-bold text-[10px] py-2 rounded-xl transition flex justify-center items-center gap-1 shadow-sm"
                >
                  <span className="material-symbols-outlined text-xs">report</span>
                  Report
                </button>
                <button
                  onClick={calculateRoute}
                  disabled={isRouting}
                  className="flex-1 bg-[#0d631b] hover:bg-[#0a5215] text-white font-bold text-[10px] py-2 rounded-xl transition flex justify-center items-center gap-1 shadow-sm disabled:opacity-50"
                >
                  {isRouting ? (
                    <span className="material-symbols-outlined text-xs animate-spin">refresh</span>
                  ) : (
                    <span className="material-symbols-outlined text-xs">directions_walk</span>
                  )}
                  {isRouting ? "Routing..." : "Route"}
                </button>
              </div>

              {/* Show Route Distance and Duration if calculated */}
              {routePolyline && distance && duration && (
                <div className="flex items-center justify-between bg-green-50 text-green-800 border border-green-200 rounded-xl px-3 py-2 mt-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <span className="material-symbols-outlined text-sm">directions_walk</span>
                    {distance}
                  </div>
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    {duration}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Community Reports Details Modal */}
      {showReportsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 animate-fade-in"
          onClick={() => setShowReportsModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[80vh] flex flex-col p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-base text-gray-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#0d631b]">warning</span>
                Community Safety Reports
              </h3>
              <button
                onClick={() => setShowReportsModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3.5">
              {/* Default Reports */}
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-xs text-gray-800 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-gray-400">
                      lightbulb
                    </span>
                    Poor Lighting
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">3 hours ago</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Bus stop near main junction transit hub.
                </p>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-xs text-gray-800 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-gray-400">groups</span>
                    Crowded Area
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">5 hours ago</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Exit pathway experiencing heavy foot traffic.
                </p>
              </div>

              {/* User Submitted Reports */}
              {reports.length === 0 ? (
                <p className="text-[10px] text-gray-400 text-center py-4">
                  No additional community incident reports submitted yet.
                </p>
              ) : (
                reports.map((rep) => {
                  const typeItem = TYPES.find((t) => t.id === rep.type) || {
                    icon: "report",
                    label: rep.type,
                  };
                  const date = rep.timestamp ? rep.timestamp.toDate() : new Date();
                  const fmtTime = date.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <div key={rep.id} className="bg-red-50/50 border border-red-100 rounded-xl p-3">
                      <div className="flex justify-between items-baseline">
                        <span className="font-bold text-xs text-red-700 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">{typeItem.icon}</span>
                          {typeItem.label}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">{fmtTime}</span>
                      </div>
                      <p className="text-[11px] text-gray-700 font-semibold mt-1">
                        Location: {rep.location}
                      </p>
                      {rep.note && (
                        <p className="text-[11px] text-gray-655 mt-0.5 leading-relaxed bg-white/70 border border-red-50 p-2 rounded-lg italic">
                          "{rep.note}"
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Safety Score Info Popup Modal */}
      {showScorePopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in"
          onClick={() => setShowScorePopup(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5 flex flex-col gap-4 animate-scale-in text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-sm text-gray-900">Area Safety Details</h3>
              <button
                onClick={() => setShowScorePopup(false)}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-16 h-16 rounded-full flex flex-col items-center justify-center text-white font-black shadow-md border border-white/20 ${
                  avgScore >= 7
                    ? "bg-green-600"
                    : avgScore >= 4
                      ? "bg-amber-500"
                      : avgScore > 0
                        ? "bg-red-600"
                        : "bg-gray-400"
                }`}
              >
                <span className="text-xl">{avgScore > 0 ? avgScore.toFixed(1) : "N/A"}</span>
                <span className="text-[8px] uppercase tracking-wider -mt-0.5">Score</span>
              </div>
              <p className="text-xs text-gray-500 font-medium">Based on {ratingCount} ratings</p>
            </div>

            {topTags.length > 0 ? (
              <div className="flex flex-col gap-1.5 text-left bg-gray-50 p-3 rounded-xl">
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                  Top reported conditions
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {topTags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-white border border-gray-250 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                    >
                      <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                      {tag === "Welllit" ? "Well-lit" : tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-gray-400 italic">No conditions reported yet.</p>
            )}

            <div className="flex flex-col gap-2 mt-2">
              <button
                id="rate-this-area-popup-btn"
                onClick={() => {
                  setShowScorePopup(false);
                  setShowRateModal(true);
                }}
                className="w-full py-3 bg-[#0d631b] hover:bg-[#0a5215] text-white font-bold rounded-xl text-xs transition active:scale-[0.98]"
              >
                Rate this Area
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rate This Area Screen Overlay Modal */}
      {showRateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in"
          onClick={() => setShowRateModal(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#0d631b]">star_rate</span>
                <h3 className="font-extrabold text-base text-gray-900">Rate Safety of This Area</h3>
              </div>
              <button
                onClick={() => setShowRateModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* 1-to-10 selector */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Select Safety Score (1-10)
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
                  const isSelected = newScore === score;
                  return (
                    <button
                      key={score}
                      onClick={() => setNewScore(score)}
                      className={`h-10 rounded-xl font-black text-sm flex items-center justify-center transition active:scale-95 ${
                        isSelected
                          ? "bg-[#0d631b] text-white shadow-md scale-105"
                          : "bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200"
                      }`}
                    >
                      {score}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-wide px-1">
                <span>1 - Dangerous</span>
                <span>10 - Very Safe</span>
              </div>
            </div>

            {/* Tags checkboxes */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Report Area Conditions (Optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {["Poor lighting", "Isolated", "Welllit", "Crowded", "Police presence"].map(
                  (tag) => {
                    const isSelected = newTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => {
                          if (isSelected) {
                            setNewTags(newTags.filter((t) => t !== tag));
                          } else {
                            setNewTags([...newTags, tag]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition active:scale-[0.98] ${
                          isSelected
                            ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                            : "bg-white border-gray-250 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {tag === "Welllit" ? "Well-lit" : tag}
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            <button
              id="submit-rating-btn"
              onClick={handleRatingSubmit}
              disabled={newScore === null}
              className={`w-full py-4 rounded-xl font-black text-sm text-white transition active:scale-[0.98] mt-2 shadow ${
                newScore !== null
                  ? "bg-[#0d631b] hover:bg-[#0a5215]"
                  : "bg-gray-250 text-gray-400 cursor-not-allowed shadow-none"
              }`}
            >
              Submit Safety Rating
            </button>
          </div>
        </div>
      )}

      {/* Submit Report Modal */}
      {showSubmitReportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in"
          onClick={() => setShowSubmitReportModal(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600">report</span>
                <h3 className="font-extrabold text-base text-gray-900">Report Incident</h3>
              </div>
              <button
                onClick={() => setShowSubmitReportModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Select Incident Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map((t) => {
                  const isSelected = reportType === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setReportType(t.id)}
                      className={`h-10 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 ${
                        isSelected
                          ? "bg-red-50 text-red-700 border-red-200 border-2"
                          : "bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200"
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">{t.icon}</span>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Additional Details (Optional)
              </label>
              <textarea
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                placeholder="Describe what happened or what you saw..."
                className="w-full h-24 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
              />
            </div>

            <button
              onClick={handleReportSubmit}
              className="w-full py-4 rounded-xl font-black text-sm text-white transition active:scale-[0.98] mt-2 shadow bg-red-600 hover:bg-red-700"
            >
              Submit Report
            </button>
          </div>
        </div>
      )}

      {/* Submission Success Confirmation Screen overlay */}
      {ratingSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xs p-6 flex flex-col items-center gap-3.5 text-center border-2 border-emerald-400 animate-scale-in">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner animate-pulse">
              <span className="material-symbols-outlined text-3xl font-black">check_circle</span>
            </div>
            <div>
              <h3 className="font-extrabold text-base text-gray-900">Rating Submitted</h3>
              <p className="text-xs text-gray-500 leading-normal mt-1">
                Your rating helps keep your community safe.
              </p>
            </div>
          </div>
        </div>
      )}

      {reportSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xs p-6 flex flex-col items-center gap-3.5 text-center border-2 border-red-400 animate-scale-in">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center shadow-inner animate-pulse">
              <span className="material-symbols-outlined text-3xl font-black">check_circle</span>
            </div>
            <div>
              <h3 className="font-extrabold text-base text-gray-900">Report Submitted</h3>
              <p className="text-xs text-gray-500 leading-normal mt-1">
                Your report helps keep your community safe.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
