import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  registerAsGuardianAngel,
  setGuardianAvailability,
  declineLayer3,
  acknowledgeLayer3,
  getDistance,
} from "../services/guardianService";
import { subscribeToSOS } from "../services/sosService";
import { auth } from "../firebase/firebase";

export const Route = createFileRoute("/guardian")({
  head: () => ({
    meta: [{ title: "TrustNet - Guardian Angel" }],
  }),
  component: GuardianPage,
});

const DEFAULT_PROFILE = {
  registered: false,
  available: false,
  totalResponses: 7,
  rating: 4.8,
  responseHistory: [
    { id: "r1", date: "2 days ago", outcome: "Assisted", location: "Koramangala, Bengaluru" },
    { id: "r2", date: "1 week ago", outcome: "Assisted", location: "Indiranagar, Bengaluru" },
    { id: "r3", date: "2 weeks ago", outcome: "Declined", location: "HSR Layout, Bengaluru" },
  ],
};

function GuardianPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [agreed, setAgreed] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // ── Incoming SOS alert state ─────────────────────────────────────────────
  const [incomingAlert, setIncomingAlert] = useState(null);
  const [alertDistance, setAlertDistance] = useState(null);
  const [alertCountdown, setAlertCountdown] = useState(30);
  const [myLoc, setMyLoc] = useState(null);
  const countdownRef = useRef(null);
  const alertDismissed = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("trustnet_guardian_profile");
      if (raw) setProfile(JSON.parse(raw));
    } catch {
      /* fallback */
    }
  }, []);

  // ── Grab GA's own GPS location once ──────────────────────────────────────
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setMyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        /* silently ignore */
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  // ── Listen for active SOS sessions nearby (2 km) ─────────────────────────
  useEffect(() => {
    if (!profile.registered || !profile.available) return;
    const unsub = subscribeToSOS((sessions) => {
      if (alertDismissed.current) return;
      const nearby = sessions.find((s) => {
        if (!s.latitude || !s.longitude || !myLoc) return false;
        const dist = getDistance(myLoc.lat, myLoc.lng, s.latitude, s.longitude);
        return dist <= 2000; // within 2 km
      });
      if (nearby && !incomingAlert) {
        const dist = myLoc
          ? Math.round(getDistance(myLoc.lat, myLoc.lng, nearby.latitude, nearby.longitude))
          : null;
        setIncomingAlert(nearby);
        setAlertDistance(dist);
        setAlertCountdown(30);
        alertDismissed.current = false;
      }
    });
    return () => unsub();
  }, [profile.registered, profile.available, myLoc, incomingAlert]);

  // ── 30-second countdown while alert is showing ───────────────────────────
  useEffect(() => {
    if (!incomingAlert) return;
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setAlertCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          // Auto-dismiss on timeout
          alertDismissed.current = true;
          setIncomingAlert(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [incomingAlert]);

  const handleAcceptAlert = async () => {
    if (!incomingAlert) return;
    clearInterval(countdownRef.current);
    alertDismissed.current = true;
    try {
      const uid = getUid();
      await acknowledgeLayer3(incomingAlert.id, uid);
    } catch (e) {
      console.error("acknowledgeLayer3 error:", e);
    }
    setIncomingAlert(null);
    navigate({ to: "/sos-receiver", search: { sessionId: incomingAlert.id, role: "layer3" } });
  };

  const handleDeclineAlert = async () => {
    if (!incomingAlert) return;
    clearInterval(countdownRef.current);
    alertDismissed.current = true;
    try {
      const uid = getUid();
      await declineLayer3(incomingAlert.id, uid);
    } catch (e) {
      console.error("declineLayer3 error:", e);
    }
    setIncomingAlert(null);
  };

  const getUid = () => {
    if (auth.currentUser) return auth.currentUser.uid;
    try {
      const raw = localStorage.getItem("trustnet_auth_user");
      if (raw) {
        const u = JSON.parse(raw);
        return u.id || "amit123";
      }
    } catch {}
    return "amit123";
  };

  const getName = () => {
    try {
      const raw = localStorage.getItem("trustnet_auth_user");
      if (raw) {
        const u = JSON.parse(raw);
        return u.name || "Guardian Angel";
      }
    } catch {}
    return "Guardian Angel";
  };

  const saveProfile = (updated) => {
    setProfile(updated);
    localStorage.setItem("trustnet_guardian_profile", JSON.stringify(updated));
  };

  const handleRegister = async () => {
    if (!agreed) return;
    setRegistering(true);
    setErrorMsg(null);
    try {
      const uid = getUid();
      const name = getName();
      await registerAsGuardianAngel(uid, name);
      saveProfile({ ...profile, registered: true, available: true });
    } catch (err) {
      console.error("Error registering as Guardian Angel:", err);
      if (err.code === "permission-denied") {
        setErrorMsg(
          "Permission Denied: You must be logged in via Firebase (not local fallback) to become a Guardian Angel.",
        );
      } else {
        setErrorMsg(err.message || "Failed to register. Please try again.");
      }
    }
    setRegistering(false);
  };

  const toggleAvailability = async () => {
    const updatedAvailable = !profile.available;
    try {
      const uid = getUid();
      await setGuardianAvailability(uid, updatedAvailable);
      saveProfile({ ...profile, available: updatedAvailable });
    } catch (err) {
      console.error("Error toggling availability:", err);
    }
  };

  const bottomNav = [
    { to: "/", icon: "home", label: "Home", active: false },
    { to: "/heatmap", icon: "map", label: "Map", active: false },
    { to: "/circle", icon: "group", label: "Circle", active: false },
    { to: "/guardian", icon: "security", label: "Guardian", active: true },
    { to: "/profile", icon: "person", label: "Profile", active: false },
  ];

  return (
    <div className="w-full min-h-screen relative flex flex-col md:flex-row pb-24 md:pb-0 bg-[#faf9fc]">
      {/* ── Incoming SOS Alert Overlay ───────────────────────────────────── */}
      {incomingAlert && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col gap-5 overflow-hidden">
            {/* Gold pulsing header */}
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-6 flex flex-col items-center gap-3">
              {/* Pulsing gold ring animation */}
              <div className="relative flex items-center justify-center">
                <span className="absolute w-24 h-24 rounded-full bg-amber-400/40 animate-ping" />
                <span className="absolute w-20 h-20 rounded-full bg-amber-400/50 animate-ping [animation-delay:0.3s]" />
                <div className="relative z-10 w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                  <span
                    className="material-symbols-outlined text-white text-3xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    security
                  </span>
                </div>
              </div>
              <h2 className="text-white font-black text-lg tracking-tight text-center">
                🚨 Emergency Nearby
              </h2>
              <p className="text-amber-100 text-xs text-center leading-relaxed">
                {alertDistance !== null
                  ? `Someone needs help ~${alertDistance}m from you. Can you respond?`
                  : "Someone nearby needs urgent help. Can you respond?"}
              </p>
            </div>

            {/* 30-second SVG countdown ring */}
            <div className="flex flex-col items-center gap-1 px-6">
              <div className="relative w-20 h-20">
                {(() => {
                  const r = 34;
                  const c = 2 * Math.PI * r;
                  return (
                    <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                      <circle cx="40" cy="40" r={r} stroke="#f3f4f6" strokeWidth="7" fill="none" />
                      <circle
                        cx="40"
                        cy="40"
                        r={r}
                        stroke={alertCountdown > 10 ? "#f59e0b" : "#ef4444"}
                        strokeWidth="7"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={c}
                        strokeDashoffset={c * (1 - alertCountdown / 30)}
                        className="transition-all duration-1000 ease-linear"
                      />
                    </svg>
                  );
                })()}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className={`text-lg font-black leading-none ${alertCountdown <= 10 ? "text-red-600" : "text-amber-600"}`}
                  >
                    {alertCountdown}
                  </span>
                  <span className="text-[8px] text-gray-400 font-bold uppercase">secs</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 font-semibold">Respond within 30 seconds</p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={handleDeclineAlert}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs py-3.5 rounded-xl transition active:scale-[0.98] flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">close</span>I can't help
              </button>
              <button
                onClick={handleAcceptAlert}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs py-3.5 rounded-xl transition active:scale-[0.98] shadow-lg flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">directions_run</span>I can help!
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Side Nav */}
      <nav className="hidden md:flex flex-col bg-white text-gray-800 h-full rounded-r-2xl shadow-sm border-r border-gray-150 w-72 max-w-[80vw] p-5 fixed left-0 top-0 z-50">
        <div className="flex items-center gap-4 mb-8 pt-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
            <span
              className="material-symbols-outlined text-amber-700 text-2xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              security
            </span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Guardian Angel</h2>
            <p
              className={`text-xs font-semibold mt-0.5 ${profile.registered ? (profile.available ? "text-emerald-600" : "text-gray-400") : "text-gray-400"}`}
            >
              {profile.registered ? (profile.available ? "On Duty" : "Off Duty") : "Not registered"}
            </p>
          </div>
        </div>
        <ul className="flex flex-col gap-1.5 mt-auto">
          {bottomNav.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-full transition-all text-sm font-medium ${item.active ? "bg-amber-50 text-amber-700 font-bold" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <span
                  className="material-symbols-outlined text-lg"
                  style={item.active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200 flex justify-between items-center px-4 h-16 w-full md:hidden">
        <div className="flex items-center gap-3">
          <span
            className="material-symbols-outlined text-amber-600 text-2xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            security
          </span>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">Guardian Angel</h1>
        </div>
        <Link
          to="/notifications"
          className="w-10 h-10 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 transition"
        >
          <span className="material-symbols-outlined">notifications</span>
        </Link>
      </header>

      {/* Main */}
      <main className="flex-grow w-full max-w-2xl mx-auto px-4 py-6 md:ml-72 pb-24 md:pb-8 flex flex-col gap-6">
        {!profile.registered ? (
          <div className="flex flex-col gap-6 animate-fade-in">
            {/* Hero Banner */}
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-7 text-white flex flex-col gap-4 shadow-xl">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-4xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  shield_with_heart
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight">Become a Guardian Angel</h1>
                <p className="text-sm opacity-90 mt-2 leading-relaxed">
                  Volunteer to receive Layer 3 SOS alerts when someone nearby needs urgent help and
                  no one else has responded.
                </p>
              </div>
            </div>

            {/* What it involves */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
              <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-lg">info</span>
                What this involves
              </h2>
              <ul className="flex flex-col gap-3">
                {[
                  {
                    icon: "notifications_active",
                    text: "Receive Layer 3 SOS alerts when you are nearby and available",
                  },
                  {
                    icon: "location_on",
                    text: "Your approximate location is shared to match you to nearby incidents",
                  },
                  {
                    icon: "toggle_on",
                    text: "Full ON/OFF control — no obligation when you are off-duty",
                  },
                  { icon: "star", text: "Build a community response rating visible in TrustNet" },
                  {
                    icon: "privacy_tip",
                    text: "Your details are never shared until you confirm you are responding",
                  },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="material-symbols-outlined text-amber-500 text-base shrink-0 mt-0.5">
                      {item.icon}
                    </span>
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>

            {/* Checkbox agreement */}
            <label className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 cursor-pointer select-none">
              <input
                type="checkbox"
                id="guardian-agree-checkbox"
                checked={agreed}
                onChange={() => setAgreed(!agreed)}
                className="mt-0.5 w-5 h-5 accent-amber-600 shrink-0"
              />

              <span className="text-sm text-gray-800 leading-relaxed font-medium">
                I understand my role as a Guardian Angel and agree to respond to nearby SOS alerts
                when I am available.
              </span>
            </label>

            {errorMsg && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium">
                {errorMsg}
              </div>
            )}

            {/* Register button */}
            <button
              id="guardian-register-btn"
              onClick={handleRegister}
              disabled={!agreed || registering}
              className={`w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] ${agreed ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {registering ? "progress_activity" : "security"}
              </span>
              {registering ? "Registering..." : "Register as Guardian Angel"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-5 animate-fade-in">
            {/* Dashboard Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-amber-500 text-2xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    security
                  </span>
                  Guardian Dashboard
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">Your community helper profile</p>
              </div>
              <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full flex items-center gap-1">
                <span
                  className="material-symbols-outlined text-xs"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  verified
                </span>
                Verified Guardian Angel
              </span>
            </div>

            {/* AVAILABILITY TOGGLE — most prominent element */}
            <div
              id="guardian-availability-card"
              className={`rounded-3xl p-6 flex flex-col gap-4 shadow-lg border-2 transition-all duration-500 ${
                profile.available
                  ? "bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-400 text-white"
                  : "bg-white border-gray-200 text-gray-800"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p
                    className={`text-[10px] font-bold uppercase tracking-widest ${profile.available ? "text-white/70" : "text-gray-400"}`}
                  >
                    Availability Status
                  </p>
                  <h2 className="text-3xl font-black mt-1 tracking-tight">
                    {profile.available ? "ON DUTY" : "OFF DUTY"}
                  </h2>
                  <p
                    className={`text-xs mt-1.5 leading-relaxed ${profile.available ? "text-white/80" : "text-gray-500"}`}
                  >
                    {profile.available
                      ? "You will receive Layer 3 SOS alerts when nearby"
                      : "Toggle ON to start receiving SOS alerts in your area"}
                  </p>
                </div>
                {/* Large, impossible-to-miss toggle */}
                <button
                  id="guardian-availability-toggle"
                  role="switch"
                  aria-checked={profile.available}
                  onClick={toggleAvailability}
                  className={`w-20 h-10 rounded-full relative transition-all duration-300 shadow-inner shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    profile.available
                      ? "bg-white/30 focus:ring-white"
                      : "bg-gray-200 focus:ring-gray-400"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-8 h-8 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center ${
                      profile.available
                        ? "left-11 bg-white text-emerald-600"
                        : "left-1 bg-white text-gray-400"
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-sm"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {profile.available ? "check_circle" : "cancel"}
                    </span>
                  </span>
                </button>
              </div>

              {profile.available && (
                <div className="flex items-center gap-2.5 bg-white/15 rounded-xl px-3.5 py-2.5">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0"></span>
                  <span className="text-xs font-semibold text-white">
                    Monitoring SOS alerts within 500m radius
                  </span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: "Responses",
                  value: String(profile.totalResponses),
                  icon: "emergency_share",
                  bg: "bg-emerald-50",
                  text: "text-emerald-600",
                },
                {
                  label: "Star Rating",
                  value: `${profile.rating}★`,
                  icon: "star",
                  bg: "bg-amber-50",
                  text: "text-amber-600",
                },
                {
                  label: "Community",
                  value: "Top 5%",
                  icon: "workspace_premium",
                  bg: "bg-purple-50",
                  text: "text-purple-600",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm text-center"
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center ${stat.bg} ${stat.text}`}
                  >
                    <span
                      className="material-symbols-outlined text-lg"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {stat.icon}
                    </span>
                  </div>
                  <span className="text-base font-black text-gray-900">{stat.value}</span>
                  <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Guardian Angel Profile Card — shown to distressed users when matched */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">visibility</span>
                Your Guardian Angel Profile (visible to distressed users when matched)
              </p>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img
                    alt="Guardian Angel Profile"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBaKBoKnNqKnNn5PWbMTe5gomvq-dzgEhryLZvEmyIGoU30YSiiR4-St6_9_Cte3wBAE96suYIqP5G40Y3Ij-pIuS-3_VeijFL9KrOa14J2ydjNX4LnCH-4YzytJZ2XwKS7PiBxckvJUAt9Fr57N0zvO0nqmahe821JAgA-LnThrSqjX94bKcWMXdyFIbsASMGhhTBWkLnkPwdOWhyyrJ8x5yJ_6frJqo2cYzHFzFIpovNxfg3X2IzYM-gXmzQaJy7o5A9oEj4nydsg"
                    className="w-14 h-14 rounded-full object-cover border-2 border-amber-300 shadow"
                  />

                  <span className="absolute -bottom-1 -right-1 bg-amber-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-white flex items-center gap-0.5">
                    <span
                      className="material-symbols-outlined text-[8px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      verified
                    </span>
                    GA
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-gray-900">Rakesh Kumar</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {"★★★★★".split("").map((s, i) => (
                      <span
                        key={i}
                        className={`text-xs ${i < Math.round(profile.rating) ? "text-amber-500" : "text-gray-300"}`}
                      >
                        {s}
                      </span>
                    ))}
                    <span className="text-[9px] text-gray-500 ml-1">
                      {profile.rating} ({profile.totalResponses} responses)
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">Verified Guardian • 340m away</p>
                </div>
              </div>
            </div>

            {/* Response History */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-gray-500">history</span>
                Response History
              </h3>
              <ul className="flex flex-col gap-3">
                {profile.responseHistory.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${r.outcome === "Assisted" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}
                      >
                        <span
                          className="material-symbols-outlined text-sm"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          {r.outcome === "Assisted" ? "check_circle" : "cancel"}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-800">{r.location}</p>
                        <p className="text-[9px] text-gray-400 mt-0.5">{r.date}</p>
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${r.outcome === "Assisted" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
                    >
                      {r.outcome}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => saveProfile({ ...profile, registered: false, available: false })}
              className="text-xs text-gray-400 hover:text-red-500 transition font-semibold text-center py-2"
            >
              Deregister as Guardian Angel
            </button>
          </div>
        )}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-40 md:hidden">
        {bottomNav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 ${item.active ? "text-amber-600" : "text-gray-500"}`}
          >
            <span
              className="material-symbols-outlined text-2xl"
              style={item.active ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {item.icon}
            </span>
            <span className="text-[9px] font-semibold">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
