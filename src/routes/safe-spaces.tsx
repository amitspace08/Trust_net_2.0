import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { registerSafeSpace, getSafeSpacesWithinRadius, fetchPlaces } from "../services/safeSpaceService";

export const Route = createFileRoute("/safe-spaces")({
  head: () => ({
    meta: [{ title: "TrustNet - Safe Spaces" }],
  }),
  component: SafeSpacesPage,
});

// ─── Mock data ─────────────────────────────────────────────────────────────
export interface SafeSpace {
  id: string;
  name: string;
  type: "shop" | "pharmacy" | "petrol_station" | "police_station" | "public_building";
  distance: number; // metres
  address: string;
  lat: number;
  lng: number;
  mapPin?: { top: string; left: string }; // % position on mock map
}

// MOCK_SAFE_SPACES removed.

const TYPE_META: Record<
  SafeSpace["type"],
  { icon: string; label: string; color: string; bg: string }
> = {
  shop: { icon: "storefront", label: "Shop", color: "text-blue-700", bg: "bg-blue-50" },
  pharmacy: {
    icon: "local_pharmacy",
    label: "Pharmacy",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
  },
  petrol_station: {
    icon: "local_gas_station",
    label: "Petrol Station",
    color: "text-orange-700",
    bg: "bg-orange-50",
  },
  police_station: {
    icon: "local_police",
    label: "Police Station",
    color: "text-purple-700",
    bg: "bg-purple-50",
  },
  public_building: {
    icon: "account_balance",
    label: "Public Building",
    color: "text-teal-700",
    bg: "bg-teal-50",
  },
};

// ─── Registration form ──────────────────────────────────────────────────────
interface RegForm {
  name: string;
  type: SafeSpace["type"];
  address: string;
  confirmed: boolean;
}
const EMPTY_FORM: RegForm = { name: "", type: "shop", address: "", confirmed: false };

// ─── Page component ─────────────────────────────────────────────────────────
type Tab = "list" | "register" | "detail";

function SafeSpacesPage() {
  const [tab, setTab] = useState<Tab>("list");
  const [form, setForm] = useState<RegForm>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<SafeSpace | null>(null);
  const [spaces, setSpaces] = useState<SafeSpace[]>([]);
  const [showMapPopup, setShowMapPopup] = useState<SafeSpace | null>(null);
  const [location, setLocation] = useState({ lat: 26.9124, lng: 75.7873 });

  // Get current position on mount
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (err) => console.log("Geolocation error in safe-spaces:", err),
      { enableHighAccuracy: true },
    );
  }, []);

  // Fetch Safe Spaces dynamically from Google Places API and Firestore
  useEffect(() => {
    const fetchSpaces = async () => {
      try {
        const firestoreSpaces = await getSafeSpacesWithinRadius(location.lat, location.lng, 2000);
        const mappedList: SafeSpace[] = firestoreSpaces.map((item: any) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          distance: item.distance,
          address: item.address,
          lat: item.latitude,
          lng: item.longitude,
        }));
        
        const googlePlaces = await fetchPlaces(location.lat, location.lng);
        const allSpaces = [...mappedList, ...googlePlaces].sort((a, b) => a.distance - b.distance);
        
        // Add random pins for map visualization
        const finalSpaces = allSpaces.map(space => ({
          ...space,
          mapPin: {
            top: `${Math.floor(Math.random() * 60) + 20}%`,
            left: `${Math.floor(Math.random() * 60) + 20}%`,
          },
        }));

        setSpaces(finalSpaces);
      } catch (err) {
        console.error("Error loading safe spaces:", err);
      }
    };
    fetchSpaces();
  }, [location]);

  const handleSubmit = async () => {
    if (!form.name || !form.address || !form.confirmed) return;
    try {
      await registerSafeSpace(form.name, form.type, location.lat, location.lng, form.address);

      // Refresh list immediately
      const list = await getSafeSpacesWithinRadius(location.lat, location.lng, 10);
      const mappedList: SafeSpace[] = list.map((item: any) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        distance: item.distance,
        address: item.address,
        lat: item.latitude,
        lng: item.longitude,
      }));
      setSpaces(mappedList);

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setForm(EMPTY_FORM);
        setTab("list");
      }, 2000);
    } catch (err) {
      console.error("Failed to register safe space:", err);
    }
  };

  const bottomNav = [
    { to: "/", icon: "home", label: "Home" },
    { to: "/heatmap", icon: "map", label: "Map" },
    { to: "/circle", icon: "group", label: "Circle" },
    { to: "/guardian", icon: "security", label: "Guardian" },
    { to: "/profile", icon: "person", label: "Profile" },
  ];

  return (
    <div className="w-full min-h-screen relative flex flex-col md:flex-row pb-24 md:pb-0 bg-[#faf9fc]">
      {/* Side Nav */}
      <nav className="hidden md:flex flex-col bg-white text-gray-800 h-full rounded-r-2xl shadow-sm border-r border-gray-150 w-72 max-w-[80vw] p-5 fixed left-0 top-0 z-50">
        <div className="flex items-center gap-4 mb-8 pt-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
            <span
              className="material-symbols-outlined text-emerald-700 text-2xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              store
            </span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Safe Spaces</h2>
            <p className="text-xs text-gray-500 mt-0.5">{spaces.length} spaces nearby</p>
          </div>
        </div>
        <ul className="flex flex-col gap-1.5 mt-auto">
          {bottomNav.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to as "/"}
                className="flex items-center gap-3 px-4 py-2.5 rounded-full text-gray-600 hover:bg-gray-100 transition-all text-sm font-medium"
              >
                <span className="material-symbols-outlined text-lg">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200 flex items-center px-4 h-16 w-full md:hidden gap-3">
        <Link
          to="/"
          className="w-8 h-8 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <span
          className="material-symbols-outlined text-emerald-600 text-xl"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          store
        </span>
        <h1 className="text-lg font-bold text-gray-900 tracking-tight flex-1">Safe Spaces</h1>
        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
          {spaces.length} nearby
        </span>
      </header>

      {/* Main */}
      <main className="flex-grow w-full max-w-2xl mx-auto px-4 py-5 md:ml-72 pb-28 md:pb-8 flex flex-col gap-5">
        {/* Tab bar */}
        <div className="flex bg-white border border-gray-200 rounded-2xl p-1 shadow-sm gap-1">
          {(["list", "register"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setSelectedSpace(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${tab === t ? "bg-emerald-600 text-white shadow" : "text-gray-500 hover:bg-gray-50"}`}
            >
              {t === "list" ? "Safe Spaces Nearby" : "Register a Space"}
            </button>
          ))}
        </div>

        {/* ── LIST TAB ── */}
        {tab === "list" && !selectedSpace && (
          <div className="flex flex-col gap-4 animate-fade-in">
            {/* Mock map with green pins */}
            <div className="relative w-full h-52 rounded-2xl overflow-hidden shadow-md bg-gray-200">
              <img
                alt="Map with Safe Spaces"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuA0_mjB-9zilExVl153uNBx4pz2nq5UhlWh2z3yjHQ5ACtL-NUhLTSMc8A-RVmUAX2TCZML22Kmr5RH5PuwhHZLVkmzPKb04sD9Lyk0s_dArLLtDbFqcYYpoQnQpZxtugG6wY_9Qi2aHTrGXCg357ZA1vOLEutYsXdavFXlc7hwZy-dirGRlX3nTp4QMrmG1XTNvEDPwN1B0oHSBH8lA6zGpQ1_JJvG9K0YbPvXNym7n3p7LzTMJG6dm-mhWCmV6-rvtoH6-VQZFSJ0"
                className="absolute inset-0 w-full h-full object-cover brightness-90"
              />
              {spaces.slice(0, 5).filter((s) => s.mapPin).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setShowMapPopup(s)}
                  style={{ top: s.mapPin!.top, left: s.mapPin!.left }}
                  className="absolute transform -translate-x-1/2 -translate-y-full z-10 flex flex-col items-center"
                  title={s.name}
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-600 border-2 border-white shadow-lg flex items-center justify-center hover:scale-110 transition">
                    <span
                      className="material-symbols-outlined text-white text-sm"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {TYPE_META[s.type].icon}
                    </span>
                  </div>
                  <div className="w-2 h-2 bg-emerald-600 rotate-45 -mt-1 shadow"></div>
                </button>
              ))}
              <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm text-[9px] font-bold text-emerald-700 px-2 py-1 rounded-full flex items-center gap-1 shadow">
                <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                TrustNet Safe Spaces
              </div>
            </div>

            {/* Map popup */}
            {showMapPopup && (
              <div
                className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 animate-fade-in"
                onClick={() => setShowMapPopup(null)}
              >
                <div
                  className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-5 flex flex-col gap-4 animate-scale-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center ${TYPE_META[showMapPopup.type].bg}`}
                    >
                      <span
                        className={`material-symbols-outlined text-2xl ${TYPE_META[showMapPopup.type].color}`}
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {TYPE_META[showMapPopup.type].icon}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{showMapPopup.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {TYPE_META[showMapPopup.type].label} • {showMapPopup.distance}m away
                      </p>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                      {showMapPopup.distance}m
                    </span>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 flex items-start gap-2">
                    <span
                      className="material-symbols-outlined text-emerald-600 text-lg shrink-0 mt-0.5"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      verified_user
                    </span>
                    <p className="text-xs text-emerald-800 font-semibold leading-relaxed">
                      TrustNet Safe Space — you can walk in and ask for help here.
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">{showMapPopup.address}</p>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${showMapPopup.lat},${showMapPopup.lng}&travelmode=walking`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition active:scale-[0.98] shadow"
                  >
                    <span className="material-symbols-outlined text-lg">directions_walk</span>
                    Get Walking Directions
                  </a>
                  <button
                    onClick={() => setShowMapPopup(null)}
                    className="text-xs text-gray-400 font-semibold text-center"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* Section header */}
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-600 text-base">place</span>
                Within 1km — sorted by distance
              </h2>
              <span className="text-[10px] font-semibold text-gray-400">
                {spaces.filter((s) => s.distance <= 1000).length} results
              </span>
            </div>

            {/* List */}
            <ul className="flex flex-col gap-3">
              {spaces
                .filter((s) => s.distance <= 1000)
                .sort((a, b) => a.distance - b.distance)
                .map((s) => {
                  const meta = TYPE_META[s.type];
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => setSelectedSpace(s)}
                        className="w-full bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:border-emerald-300 hover:shadow-md transition flex items-center gap-4 text-left group"
                      >
                        {/* Green building icon */}
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${meta.bg} group-hover:scale-105 transition-transform`}
                        >
                          <span
                            className={`material-symbols-outlined text-2xl ${meta.color}`}
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            {meta.icon}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-gray-900 truncate">{s.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{s.address}</p>
                          <p className="text-[10px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">verified_user</span>
                            TrustNet Safe Space
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full">
                            {s.distance}m
                          </span>
                          <span
                            className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}

        {/* ── DETAIL VIEW ── */}
        {tab === "list" &&
          selectedSpace &&
          (() => {
            const s = selectedSpace;
            const meta = TYPE_META[s.type];
            return (
              <div className="flex flex-col gap-4 animate-fade-in">
                <button
                  onClick={() => setSelectedSpace(null)}
                  className="flex items-center gap-2 text-sm text-gray-600 font-semibold hover:text-gray-800 transition self-start"
                >
                  <span className="material-symbols-outlined text-base">arrow_back</span>Back to
                  list
                </button>

                {/* Hero card */}
                <div
                  className={`rounded-3xl p-6 flex flex-col gap-4 ${meta.bg} border border-${meta.color.split("-")[1]}-200`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm shrink-0">
                      <span
                        className={`material-symbols-outlined text-3xl ${meta.color}`}
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {meta.icon}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h2 className="font-black text-lg text-gray-900">{s.name}</h2>
                      <p className="text-xs text-gray-600 mt-0.5">{meta.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{s.address}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1 bg-white rounded-2xl p-3 text-center shadow-sm">
                      <p className="text-xl font-black text-gray-900">{s.distance}m</p>
                      <p className="text-[9px] text-gray-500 uppercase tracking-wide font-semibold">
                        Distance
                      </p>
                    </div>
                    <div className="flex-1 bg-white rounded-2xl p-3 text-center shadow-sm">
                      <p className="text-xl font-black text-emerald-600">Open</p>
                      <p className="text-[9px] text-gray-500 uppercase tracking-wide font-semibold">
                        Status
                      </p>
                    </div>
                  </div>
                </div>

                {/* TrustNet Safe Space badge */}
                <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 flex items-start gap-3">
                  <span
                    className="material-symbols-outlined text-emerald-600 text-2xl shrink-0"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    verified_user
                  </span>
                  <div>
                    <p className="font-bold text-emerald-800 text-sm">TrustNet Safe Space</p>
                    <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
                      You can walk in and ask for help here. This location is registered in the
                      TrustNet safety network.
                    </p>
                  </div>
                </div>

                {/* Navigate button */}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=walking`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl flex items-center justify-center gap-2 text-sm transition active:scale-[0.98] shadow-lg"
                >
                  <span className="material-symbols-outlined text-xl">directions_walk</span>
                  Navigate — Walking Directions
                </a>
              </div>
            );
          })()}

        {/* ── REGISTER TAB ── */}
        {tab === "register" && (
          <div className="flex flex-col gap-5 animate-fade-in">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-6 text-white flex flex-col gap-3 shadow-xl">
              <span
                className="material-symbols-outlined text-3xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                add_business
              </span>
              <div>
                <h1 className="text-xl font-black">Register a Safe Space</h1>
                <p className="text-sm opacity-90 mt-1 leading-relaxed">
                  Help your community by registering your business or location as a TrustNet Safe
                  Space.
                </p>
              </div>
            </div>

            {submitted ? (
              <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-8 flex flex-col items-center gap-3 text-center animate-scale-in">
                <span
                  className="material-symbols-outlined text-5xl text-emerald-600"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
                <h2 className="font-black text-emerald-800">Space Registered!</h2>
                <p className="text-xs text-emerald-700">
                  Your location has been added to TrustNet Safe Spaces.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Field 1: Business name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                    Business / Location Name *
                  </label>
                  <input
                    id="ss-name-input"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Apollo Pharmacy"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                  />
                </div>

                {/* Field 2: Type */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                    Type *
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {(
                      Object.entries(TYPE_META) as [
                        SafeSpace["type"],
                        (typeof TYPE_META)[SafeSpace["type"]],
                      ][]
                    ).map(([key, meta]) => (
                      <button
                        key={key}
                        onClick={() => setForm({ ...form, type: key })}
                        className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold transition ${form.type === key ? `${meta.bg} ${meta.color} border-current` : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                      >
                        <span
                          className="material-symbols-outlined text-base"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          {meta.icon}
                        </span>
                        {meta.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Field 3: Address */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                    Street Address *
                  </label>
                  <input
                    id="ss-address-input"
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="e.g. 12 MG Road, Bengaluru"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                  />
                </div>

                {/* Field 4: GPS confirmation */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                  <span
                    className="material-symbols-outlined text-emerald-600 text-2xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    my_location
                  </span>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-800">GPS Location</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      12.9762° N, 77.6083° E — Indiranagar, Bengaluru
                    </p>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
                    Confirmed
                  </span>
                </div>

                {/* Field 5: Agreement checkbox */}
                <label className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 cursor-pointer select-none">
                  <input
                    id="ss-confirm-checkbox"
                    type="checkbox"
                    checked={form.confirmed}
                    onChange={(e) => setForm({ ...form, confirmed: e.target.checked })}
                    className="mt-0.5 w-5 h-5 accent-emerald-600 shrink-0"
                  />
                  <span className="text-sm text-gray-800 font-medium leading-relaxed">
                    I confirm this is a genuine, publicly accessible safe location and agree to
                    display the TrustNet Safe Space badge.
                  </span>
                </label>

                <button
                  id="ss-register-btn"
                  onClick={handleSubmit}
                  disabled={!form.name || !form.address || !form.confirmed}
                  className={`w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition shadow-lg active:scale-[0.98] ${form.name && form.address && form.confirmed ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    add_business
                  </span>
                  Register Safe Space
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-40 md:hidden">
        {bottomNav.map((item) => (
          <Link
            key={item.to}
            to={item.to as "/"}
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-gray-500"
          >
            <span className="material-symbols-outlined text-2xl">{item.icon}</span>
            <span className="text-[9px] font-semibold">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
