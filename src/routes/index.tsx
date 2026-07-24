import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { db } from "../firebase/firebase";
import { UserAvatar } from "../components/ui/UserAvatar";
import Map from "../components/ui/Map";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "TrustNet - Home" }],
  }),
  component: HomePage,
});

function HomePage() {
  const { user } = useAuth();
  const avatarUrl = user?.avatar || user?.profile_photo || "";
  const router = useRouter();

  // Long-press hold state
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const HOLD_DURATION = 1500; // 1.5 seconds

  const startHold = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsHolding(true);
    setHoldProgress(0);
    startTimeRef.current = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startTimeRef.current;
      const progress = Math.min(1, elapsed / HOLD_DURATION);
      setHoldProgress(progress);

      if (progress >= 1) {
        setIsHolding(false);
        setHoldProgress(0);
        router.navigate({ to: "/sos" }); // Bypasses to Countdown screen
        return;
      }
      holdTimerRef.current = requestAnimationFrame(tick);
    };

    holdTimerRef.current = requestAnimationFrame(tick);
  };

  const cancelHold = () => {
    setIsHolding(false);
    setHoldProgress(0);
    if (holdTimerRef.current) {
      cancelAnimationFrame(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) cancelAnimationFrame(holdTimerRef.current);
    };
  }, []);

  const r = 90;
  const c = 2 * Math.PI * r;

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
                className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-[#0d631b]/10 text-[#0d631b] font-bold text-sm"
              >
                <span
                  className="material-symbols-outlined text-lg fill"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  home
                </span>
                Home
              </Link>
            </li>
            <li>
              <Link
                to="/heatmap"
                className="flex items-center gap-3 px-4 py-2.5 rounded-full text-gray-600 hover:bg-gray-100 transition-all text-sm font-medium"
              >
                <span className="material-symbols-outlined text-lg">map</span>
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

      {/* Main Canvas */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 md:ml-72 pb-24 md:pb-6 flex flex-col gap-6">
        {/* Welcome Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
              Good Evening, {user?.name.split(" ")[0] || "Priya"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Ready to stay safe tonight?</p>
          </div>
          <UserAvatar
            name={user?.name || "User"}
            avatarUrl={avatarUrl}
            sizeClassName="w-12 h-12 text-base font-semibold"
            className="border border-gray-100 shadow-sm md:hidden"
          />
        </div>

        {/* Safety Status Card */}
        <div className="bg-gradient-to-r from-emerald-800 to-green-700 text-white rounded-2xl p-5 flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="absolute inset-0 bg-white/5 pointer-events-none"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center border border-white/20">
              <span
                className="material-symbols-outlined text-2xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified_user
              </span>
            </div>
            <div>
              <h3 className="font-bold text-sm">Safe Area</h3>
              <p className="text-[11px] opacity-90 mt-0.5">
                8.4/10 Safety Score • Verified 2 mins ago
              </p>
            </div>
          </div>
          <button className="bg-white text-emerald-800 px-4.5 py-1.5 rounded-full font-bold text-xs hover:bg-gray-100 transition relative z-10 shadow-sm">
            Details
          </button>
        </div>

        {/* Core SOS Button Activator - Centerpiece */}
        <section className="bg-white border border-gray-200/80 rounded-2xl p-6 flex flex-col items-center justify-center shadow-sm relative overflow-hidden py-10">
          <h3 className="font-bold text-sm text-gray-900 tracking-tight text-center mb-1">
            Emergency Activator
          </h3>
          <p className="text-xs text-gray-500 text-center max-w-xs mb-8">
            Press and hold for 1.5s. Accidental taps will not trigger the alarm.
          </p>

          {/* Interactive hold-to-activate red circle */}
          <div
            className="relative w-56 h-56 flex items-center justify-center select-none"
            style={{ touchAction: "none" }}
          >
            {/* Ambient Pulsing Glow rings */}
            <span
              className={`absolute inset-0 rounded-full bg-red-500/10 transition-transform duration-500 pointer-events-none ${isHolding ? "scale-105" : "animate-ping"}`}
            />
            <span className="absolute inset-4 rounded-full bg-red-500/5 animate-pulse pointer-events-none" />

            {/* Circular Progress Ring */}
            <svg
              className="absolute w-full h-full -rotate-90 pointer-events-none"
              viewBox="0 0 200 200"
            >
              <circle cx="100" cy="100" r={r} stroke="#fee2e2" strokeWidth="8" fill="none" />
              <circle
                cx="100"
                cy="100"
                r={r}
                stroke="#ef4444"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={Math.round(c)}
                strokeDashoffset={Math.round(c * (1 - holdProgress))}
                className="transition-all duration-30"
              />
            </svg>

            {/* Hold Activator Button */}
            <button
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              onDragStart={(e) => e.preventDefault()}
              className={`w-44 h-44 rounded-full bg-red-600 text-white shadow-xl hover:bg-red-700 hover:shadow-red-500/25 transition active:scale-[0.97] flex flex-col items-center justify-center border-4 border-white relative z-10 ${
                isHolding ? "bg-red-800 border-red-200" : ""
              }`}
            >
              <span
                className="material-symbols-outlined text-4xl text-white/95"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                sos
              </span>
              <span className="text-3xl font-extrabold tracking-widest mt-1">SOS</span>
              <span className="text-[9px] uppercase font-semibold tracking-[0.2em] mt-1 text-red-200">
                {isHolding ? "Holding..." : "Hold 1.5s"}
              </span>
            </button>
          </div>
        </section>

        {/* Live Map Preview & Actions */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-8 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm h-60 relative group flex flex-col">
            <div className="absolute inset-0 w-full h-full">
              <Map />
            </div>
            <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-gray-800 px-3 py-1 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0d631b] animate-pulse"></span>
              Live Tracking Active
            </div>
            <div className="mt-auto p-4 bg-gradient-to-t from-black/60 to-transparent text-white relative z-10">
              <h3 className="font-bold text-sm">Current Location</h3>
              <p className="text-xs text-white/90 mt-0.5">
                Near MG Road Metro Hub • 3 Safe Spaces nearby
              </p>
            </div>
          </div>

          <div className="md:col-span-4 grid grid-cols-2 gap-4">
            <Link
              to="/heatmap"
              className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition shadow-sm text-gray-700"
            >
              <span className="material-symbols-outlined text-[#0d631b] text-3xl">map</span>
              <span className="text-xs font-semibold text-center">Safety Heatmap</span>
            </Link>
            <Link
              to="/circle"
              className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition shadow-sm text-gray-700"
            >
              <span className="material-symbols-outlined text-blue-600 text-3xl">group</span>
              <span className="text-xs font-semibold text-center">Trust Circle</span>
            </Link>
            <Link
              to="/guardian"
              className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition shadow-sm text-gray-700"
            >
              <span className="material-symbols-outlined text-indigo-600 text-3xl">security</span>
              <span className="text-xs font-semibold text-center">Guardian Angels</span>
            </Link>
            <Link
              to="/safe-spaces"
              className="bg-white border border-emerald-200 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-emerald-50 transition shadow-sm text-gray-700"
            >
              <span
                className="material-symbols-outlined text-emerald-600 text-3xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                store
              </span>
              <span className="text-xs font-semibold text-center text-emerald-700">
                Safe Spaces
              </span>
            </Link>
            <Link
              to="/profile"
              className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition shadow-sm text-gray-700 col-span-2"
            >
              <span className="material-symbols-outlined text-purple-600 text-3xl">person</span>
              <span className="text-xs font-semibold text-center">My Profile</span>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-4">Recent Activity</h3>
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3.5 pb-4 border-b border-gray-100">
              <div className="w-9 h-9 rounded-full bg-emerald-50 text-[#0d631b] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-lg">location_on</span>
              </div>
              <div>
                <p className="text-xs text-gray-700">
                  Arrived safely at <strong>Office</strong>
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">Today, 08:45 AM</p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-lg">warning</span>
              </div>
              <div>
                <p className="text-xs text-gray-700">
                  Caution advised near <strong>MG Road</strong> due to reported incident
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">Yesterday, 14:10 PM</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
