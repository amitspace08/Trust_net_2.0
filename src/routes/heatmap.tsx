import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { getDistance } from "../services/guardianService";
import { UserAvatar } from "../components/ui/UserAvatar";
import { loadContacts, Contact } from "../lib/contacts-db";

export const Route = createFileRoute("/heatmap")({
  head: () => ({
    meta: [{ title: "TrustNet - Heatmap" }],
  }),
  component: HeatmapPage,
});

function HeatmapPage() {
  const { user } = useAuth();
  const avatarUrl = user?.avatar || user?.profile_photo || "";
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isNightMode, setIsNightMode] = useState(false);

  interface StoredReport {
    id: string;
    type: string;
    location: string;
    note: string;
    at: number;
  }

  const [reports, setReports] = useState<StoredReport[]>([]);
  const [showReportsModal, setShowReportsModal] = useState(false);

  // Safety Rating States
  interface SafetyRating {
    score: number;
    tags: string[];
  }

  const [ratings, setRatings] = useState<SafetyRating[]>([]);
  const [showScorePopup, setShowScorePopup] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [ratingSuccess, setRatingSuccess] = useState(false);
  const [newScore, setNewScore] = useState<number | null>(null);
  const [newTags, setNewTags] = useState<string[]>([]);

  const SEED_RATINGS: SafetyRating[] = [
    { score: 8, tags: ["Welllit", "Police presence"] },
    { score: 7, tags: ["Welllit", "Crowded"] },
    { score: 7, tags: ["Police presence"] },
  ];

  const TYPES = [
    { id: "suspicious", icon: "visibility", label: "Suspicious activity" },
    { id: "harassment", icon: "report", label: "Harassment" },
    { id: "theft", icon: "shopping_bag", label: "Theft" },
    { id: "unsafe", icon: "warning", label: "Unsafe area" },
    { id: "accident", icon: "local_hospital", label: "Accident" },
    { id: "other", icon: "more_horiz", label: "Other" },
  ];

  const avgScore =
    ratings.length > 0
      ? Number((ratings.reduce((acc, curr) => acc + curr.score, 0) / ratings.length).toFixed(1))
      : 0;

  const getTopTags = () => {
    const tagCounts: Record<string, number> = {};
    ratings.forEach((r) => {
      r.tags.forEach((t) => {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    });
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
      .slice(0, 2);
  };

  const topTags = getTopTags();

  const handleRatingSubmit = () => {
    if (newScore === null) return;
    const newRating: SafetyRating = {
      score: newScore,
      tags: newTags,
    };
    const updatedRatings = [...ratings, newRating];
    setRatings(updatedRatings);
    try {
      localStorage.setItem("trustnet_safety_ratings", JSON.stringify(updatedRatings));
    } catch {
      // fallback
    }

    setRatingSuccess(true);
    setShowRateModal(false);
    setShowScorePopup(false);

    setTimeout(() => {
      setRatingSuccess(false);
      setNewScore(null);
      setNewTags([]);
    }, 2000);
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem("trustnet_reports");
      if (raw) {
        setReports(JSON.parse(raw));
      }
    } catch {
      // fallback
    }

    try {
      const rawRatings = localStorage.getItem("trustnet_safety_ratings");
      if (rawRatings) {
        setRatings(JSON.parse(rawRatings));
      } else {
        setRatings(SEED_RATINGS);
        localStorage.setItem("trustnet_safety_ratings", JSON.stringify(SEED_RATINGS));
      }
    } catch {
      setRatings(SEED_RATINGS);
    }
  }, []);

  // Map coordinates percentage-based simulation positions
  const PIN_POSITIONS: Record<string, { top: string; left: string }> = {
    mom: { top: "32%", left: "45%" },
    riya: { top: "50%", left: "55%" },
    arjun: { top: "65%", left: "30%" },
    default: { top: "42%", left: "62%" }, // Fallback for newly added contacts
  };

  useEffect(() => {
    setContacts(loadContacts());
  }, []);

  const getPinStyle = (id: string, index: number) => {
    return (
      PIN_POSITIONS[id] || {
        top: `${20 + ((index * 12) % 60)}%`,
        left: `${25 + ((index * 17) % 60)}%`,
      }
    );
  };

  return (
    <div className="w-full min-h-screen relative flex flex-col md:flex-row pb-24 md:pb-0 bg-[#faf9fc]">
      {/* NavigationDrawer (Web Only) */}
      <nav className="hidden md:flex flex-col bg-white text-gray-800 h-full rounded-r-2xl shadow-sm border-r border-gray-150 w-72 max-w-[80vw] p-5 fixed left-0 top-0 z-50">
        <div className="flex items-center gap-4 mb-8 pt-4">
          <UserAvatar
            name={user?.name || "User"}
            avatarUrl={avatarUrl}
            sizeClassName="w-12 h-12 text-base font-semibold"
            className="border border-gray-100"
          />
          <div>
            <h2 className="text-sm font-bold text-gray-900">{user?.name || "Priya Sharma"}</h2>
            <p className="text-xs text-gray-500">Trust Score: 98</p>
            <p className="text-xs text-[#0d631b] font-semibold mt-0.5">Safety Status: Protected</p>
          </div>
        </div>
        <ul className="flex flex-col gap-1.5">
          <li>
            <Link
              to="/settings"
              className="flex items-center gap-3 px-4 py-2.5 rounded-full text-gray-600 hover:bg-gray-100 transition-all text-sm font-medium"
            >
              <span className="material-symbols-outlined text-lg">settings_ethernet</span>
              Emergency Settings
            </Link>
          </li>
          <li>
            <Link
              to="/history"
              className="flex items-center gap-3 px-4 py-2.5 rounded-full text-gray-600 hover:bg-gray-100 transition-all text-sm font-medium"
            >
              <span className="material-symbols-outlined text-lg">history</span>
              Safety History
            </Link>
          </li>
          <li>
            <Link
              to="/privacy"
              className="flex items-center gap-3 px-4 py-2.5 rounded-full text-gray-600 hover:bg-gray-100 transition-all text-sm font-medium"
            >
              <span className="material-symbols-outlined text-lg">privacy_tip</span>
              Privacy Guard
            </Link>
          </li>
          <li>
            <Link
              to="/support"
              className="flex items-center gap-3 px-4 py-2.5 rounded-full text-gray-600 hover:bg-gray-100 transition-all text-sm font-medium"
            >
              <span className="material-symbols-outlined text-lg">help</span>
              Support
            </Link>
          </li>
        </ul>
        <div className="mt-auto">
          <ul className="flex flex-col gap-1.5">
            <li>
              <Link
                to="/"
                className="flex items-center gap-3 px-4 py-2.5 rounded-full text-gray-600 hover:bg-gray-100 transition-all text-sm font-medium"
              >
                <span className="material-symbols-outlined text-lg">home</span>
                Home
              </Link>
            </li>
            <li>
              <Link
                to="/heatmap"
                className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-[#0d631b]/10 text-[#0d631b] font-bold text-sm"
              >
                <span
                  className="material-symbols-outlined text-lg fill"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  map
                </span>
                Heatmap
              </Link>
            </li>
            <li>
              <Link
                to="/circle"
                className="flex items-center gap-3 px-4 py-2.5 rounded-full text-gray-600 hover:bg-gray-100 transition-all text-sm font-medium"
              >
                <span className="material-symbols-outlined text-lg">group</span>
                Circle
              </Link>
            </li>
            <li>
              <Link
                to="/guardian"
                className="flex items-center gap-3 px-4 py-2.5 rounded-full text-gray-600 hover:bg-gray-100 transition-all text-sm font-medium"
              >
                <span className="material-symbols-outlined text-lg">security</span>
                Guardian
              </Link>
            </li>
            <li>
              <Link
                to="/profile"
                className="flex items-center gap-3 px-4 py-2.5 rounded-full text-gray-600 hover:bg-gray-100 transition-all text-sm font-medium"
              >
                <span className="material-symbols-outlined text-lg">person</span>
                Profile
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      {/* TopAppBar (Mobile Only) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200 flex justify-between items-center px-4 h-16 w-full md:hidden">
        <div className="flex items-center gap-3">
          <button className="w-10 h-10 flex items-center justify-center rounded-full text-[#0d631b] hover:bg-gray-100 transition">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              shield_with_heart
            </span>
          </button>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">TrustNet</h1>
        </div>
        <Link
          to="/notifications"
          className="w-10 h-10 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 transition"
        >
          <span className="material-symbols-outlined">notifications</span>
        </Link>
      </header>

      {/* Map Content Canvas */}
      <main className="flex-grow relative w-full md:ml-72 h-[calc(100vh-4rem)] md:h-screen bg-gray-200 overflow-hidden flex flex-col">
        {/* Map Background */}
        <div
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
          onClick={() => setSelectedContact(null)}
        >
          <img
            alt="City Map"
            className={`w-full h-full object-cover transition-filter duration-500 ${
              isNightMode
                ? "brightness-[0.4] contrast-[1.2] invert-[0.05] hue-rotate-[180deg]"
                : "opacity-75 grayscale-[0.25]"
            }`}
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAiV7v2c_Oz5S5jyhwVy1_LmacUsZXlDGfisrMjBuG675QUy7Zqwl3_XF1QJZY0qjuaUSvA6hCljF1YlK8lR0Se1Fdhy4v_Au3ftYsUShIH3rZGJ8BNPrZdJvlYTI7M9gLen61Z5Xzn4ceKbn0kKtJrw28gcEFRNzr5N8I0gdLhc-3W3doVjLNJJssDjJE6iCnYwLFA0fmiiDN9K60mzoUESugw7rj0ezSRjGGQsU6lC6eZV1guLjqTGdkT_9b7glYCoQG8DBcqp4Sv"
          />
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

        {/* Dynamic Contact Pins on Map */}
        {contacts.map((c, index) => {
          const pos = getPinStyle(c.id, index);

          return (
            <button
              key={c.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedContact(c);
              }}
              style={{ top: pos.top, left: pos.left }}
              className={`absolute z-20 w-11 h-11 -ml-5.5 -mt-5.5 rounded-full border-2 bg-white shadow-lg flex items-center justify-center transition hover:scale-110 active:scale-95 ${
                selectedContact?.id === c.id
                  ? "ring-4 ring-[#0d631b]/30 border-[#0d631b]"
                  : "border-gray-200"
              }`}
              title={`${c.name} (Tap for details)`}
            >
              {c.shareLocation ? (
                // Location Sharing ON: Show user avatar
                <div className="relative w-full h-full rounded-full overflow-hidden p-0.5">
                  <UserAvatar
                    name={c.name}
                    avatarUrl={c.avatar}
                    sizeClassName="w-full h-full text-xs font-semibold"
                  />
                  {/* Status dot indicator (online/offline) on avatar */}
                  <span
                    className={`absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full border border-white ${
                      c.online ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                </div>
              ) : (
                // Location Sharing OFF: Show grey location_off icon
                <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                  <span
                    className="material-symbols-outlined text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    location_off
                  </span>
                </div>
              )}
            </button>
          );
        })}

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

              <div className="flex gap-2.5 mt-1">
                <a
                  href={`tel:${selectedContact.phone}`}
                  className="flex-1 py-2.5 bg-[#0d631b] hover:bg-[#0a5215] text-white text-xs font-semibold rounded-xl transition flex justify-center items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">call</span>
                  Call Contact
                </a>
                <button
                  onClick={() => navigate({ to: "/circle" })}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50 transition flex justify-center items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">group</span>
                  View in Circle
                </button>
              </div>
            </div>
          ) : (
            // Default Area Detail screen
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <h2 className="font-bold text-base text-gray-900">Downtown Transit Hub</h2>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-xs">distance</span>
                    0.2 km away
                  </p>
                </div>
                <div className="bg-red-50 text-red-600 px-3 py-1 rounded-xl font-bold text-xs flex items-center gap-1 shadow-sm">
                  <span
                    className="material-symbols-outlined text-xs"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    warning
                  </span>
                  4.2
                </div>
              </div>

              {/* Crowd Reports Chips */}
              <div className="flex flex-wrap gap-1.5 my-1">
                <div className="bg-gray-100 px-2.5 py-1 rounded-full text-[10px] text-gray-600 font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">lightbulb</span> Poor Lighting
                </div>
                <div className="bg-gray-100 px-2.5 py-1 rounded-full text-[10px] text-gray-600 font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">groups</span> Crowded
                </div>
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
                <button
                  onClick={() => setShowReportsModal(true)}
                  className="text-[10px] text-[#0d631b] hover:text-[#0a5215] font-semibold self-center ml-1 underline cursor-pointer"
                >
                  View {2 + reports.length} reports
                </button>
              </div>

              <div className="flex gap-2.5">
                <button
                  id="rate-area-panel-btn"
                  onClick={() => setShowRateModal(true)}
                  className="flex-1 border border-[#0d631b] hover:bg-green-50 text-[#0d631b] font-bold text-xs py-3 rounded-xl transition flex justify-center items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">star</span>
                  Rate this area
                </button>
                <button className="flex-1 bg-[#0d631b] hover:bg-[#0a5215] text-white font-bold text-xs py-3 rounded-xl transition flex justify-center items-center gap-1.5 shadow-sm">
                  <span className="material-symbols-outlined text-sm">directions_walk</span>
                  Find Safest Route
                </button>
              </div>
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
                  const fmtTime = new Date(rep.at).toLocaleTimeString([], {
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
              <p className="text-xs text-gray-500 font-medium">Based on {ratings.length} ratings</p>
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
    </div>
  );
}
