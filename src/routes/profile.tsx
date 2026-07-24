import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { stopSharing, updateMyLocation } from "../services/locationService";
import { UserAvatar } from "../components/ui/UserAvatar";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [{ title: "TrustNet - User Profile" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, logout } = useAuth();
  const avatarUrl = user?.avatar || user?.profile_photo || "";
  const router = useRouter();
  const [sharingLocation, setSharingLocation] = useState(true);
  const [isGuardianAngel, setIsGuardianAngel] = useState(false);

  // Check Guardian Angel registration status
  useEffect(() => {
    try {
      const raw = localStorage.getItem("trustnet_guardian_profile");
      if (raw) {
        const parsed = JSON.parse(raw);
        setIsGuardianAngel(parsed.registered === true);
      }
    } catch {
      /* fallback */
    }
  }, []);

  // Sync state with localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("trustnet_location_sharing");
      if (stored !== null) {
        setSharingLocation(stored === "true");
      }
    }
  }, []);

  const toggleLocationSharing = async () => {
    const next = !sharingLocation;
    setSharingLocation(next);
    localStorage.setItem("trustnet_location_sharing", String(next));
    if (user) {
      try {
        if (!next) {
          await stopSharing(user.id);
        } else {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              await updateMyLocation(user.id, pos.coords.latitude, pos.coords.longitude);
            },
            async (err) => {
              console.warn("Unable to get current position for toggle, writing default:", err);
              await updateMyLocation(user.id, 28.6139, 77.209);
            }
          );
        }
      } catch (error) {
        console.error("Unable to update location sharing", error);
        setSharingLocation(!next);
        localStorage.setItem("trustnet_location_sharing", String(!next));
      }
    }
  };

  return (
    <div className="w-full min-h-screen relative flex flex-col md:flex-row pb-24 md:pb-0 bg-[#faf9fc]">
      {/* NavigationDrawer (Web Only) */}
      <nav className="hidden md:flex flex-col bg-white text-gray-800 h-full rounded-r-2xl shadow-sm border-r border-gray-150 w-72 max-w-[80vw] p-5 fixed left-0 top-0 z-50">
        <div className="flex items-center gap-4 mb-8 pt-4">
          <UserAvatar
            name={user?.name || "Priya Sharma"}
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
                className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-[#0d631b]/10 text-[#0d631b] font-bold text-sm"
              >
                <span
                  className="material-symbols-outlined text-lg fill"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  person
                </span>
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

      {/* Main Content Area */}
      <main className="flex-grow w-full max-w-5xl mx-auto px-4 py-6 md:ml-72 pb-24 md:pb-6 flex flex-col gap-6">
        {/* Profile Hero Section */}
        <section className="flex flex-col items-center text-center gap-4">
          <div className="relative inline-block">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-white shadow-sm relative bg-gray-100">
              <UserAvatar
                name={user?.name || "Elena Rodriguez"}
                avatarUrl={avatarUrl}
                sizeClassName="w-24 h-24 md:w-32 md:h-32 text-3xl font-extrabold"
              />
            </div>

            {/* Pulsing Live indicator badge overlay */}
            {sharingLocation && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow animate-pulse border border-white">
                <span className="w-1.5 h-1.5 rounded-full bg-white inline-block"></span>
                LIVE
              </span>
            )}

            <div
              className="absolute bottom-0 right-2 bg-[#0d631b] text-white w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
              title="Verified Safe User"
            >
              <span
                className="material-symbols-outlined text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified
              </span>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{user?.name || "Elena Rodriguez"}</h1>
            <p className="text-sm text-gray-500 mt-1">TrustNet Guardian Member</p>
          </div>
        </section>

        {/* Bento Grid Layout */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Safety Score Card */}
          <div className="col-span-1 md:col-span-12 lg:col-span-8 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-[#0d631b]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    health_and_safety
                  </span>
                  Safety Score
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Based on recent activity and trusted contacts.
                </p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-extrabold text-[#0d631b] block">98</span>
                <span className="text-[10px] font-bold text-[#0d631b] bg-[#0d631b]/10 px-2 py-0.5 rounded-full mt-1 inline-block">
                  Excellent
                </span>
              </div>
            </div>

            {/* Sparkline Graph */}
            <div className="w-full h-20 bg-gray-50 rounded-xl relative overflow-hidden flex items-end px-2 gap-1.5 pb-2">
              <div className="absolute inset-0 opacity-5 bg-gradient-to-t from-[#0d631b] to-transparent"></div>
              <div className="w-full bg-[#0d631b]/30 rounded-t-sm" style={{ height: "60%" }}></div>
              <div className="w-full bg-[#0d631b]/50 rounded-t-sm" style={{ height: "75%" }}></div>
              <div className="w-full bg-[#0d631b]/40 rounded-t-sm" style={{ height: "65%" }}></div>
              <div className="w-full bg-[#0d631b]/70 rounded-t-sm" style={{ height: "90%" }}></div>
              <div
                className="w-full bg-[#0d631b] rounded-t-sm shadow-sm"
                style={{ height: "98%" }}
              ></div>
            </div>
          </div>

          {/* Interactive Privacy Guard & Location Sharing Toggle Card */}
          <div className="col-span-1 md:col-span-6 lg:col-span-4 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
            <div className="w-12 h-12 bg-blue-50 text-[#005faf] rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">
                {sharingLocation ? "share_location" : "location_off"}
              </span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">Location Sharing</h3>
              <p className="text-xs text-gray-500 mt-1">
                Let your trust circle contacts see your live location on the heatmap.
              </p>
            </div>
            <div className="mt-auto flex items-center justify-between pt-2">
              <span className="text-xs font-semibold text-gray-700">
                Sharing is{" "}
                <span className={sharingLocation ? "text-[#0d631b]" : "text-red-500"}>
                  {sharingLocation ? "ON" : "OFF"}
                </span>
              </span>
              <button
                role="switch"
                aria-checked={sharingLocation}
                onClick={toggleLocationSharing}
                className={`w-11 h-6 rounded-full relative transition ${sharingLocation ? "bg-[#0d631b]" : "bg-gray-300"}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ${
                    sharingLocation ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Emergency Setup */}
          <Link
            to="/settings"
            className="col-span-1 md:col-span-6 lg:col-span-4 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4 hover:border-gray-300 transition group"
          >
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform">
              <span
                className="material-symbols-outlined text-xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                sos
              </span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">Emergency Setup</h3>
              <p className="text-xs text-gray-500 mt-1">
                Configure SOS triggers (Voice, Power Button).
              </p>
            </div>
            <div className="mt-auto flex items-center text-[#0d631b] font-semibold text-xs pt-2">
              Manage Triggers
              <span className="material-symbols-outlined ml-1 text-sm group-hover:translate-x-0.5 transition-transform">
                arrow_forward
              </span>
            </div>
          </Link>

          {/* Trusted Contacts Info */}
          <Link
            to="/circle"
            className="col-span-1 md:col-span-6 lg:col-span-4 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4 hover:border-gray-300 transition group"
          >
            <div className="w-12 h-12 bg-green-50 text-[#0d631b] rounded-full flex items-center justify-center group-hover:scale-105 transition-transform">
              <span
                className="material-symbols-outlined text-xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                groups
              </span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">Trusted Circle</h3>
              <p className="text-xs text-gray-500 mt-1">
                View active guardians and request statuses.
              </p>
            </div>
            <div className="mt-auto pt-2 flex -space-x-1.5">
              <div className="w-7 h-7 rounded-full bg-gray-150 border-2 border-white flex items-center justify-center text-[9px] font-bold text-gray-600">
                JD
              </div>
              <div className="w-7 h-7 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[9px] font-bold text-blue-600">
                MR
              </div>
              <div className="w-7 h-7 rounded-full bg-green-100 border-2 border-white flex items-center justify-center text-[9px] font-bold text-[#0d631b]">
                AL
              </div>
              <div className="w-7 h-7 rounded-full bg-gray-50 border-2 border-white flex items-center justify-center text-xs text-gray-400">
                <span className="material-symbols-outlined text-xs">add</span>
              </div>
            </div>
          </Link>

          {/* Alert Preferences */}
          <div className="col-span-1 md:col-span-6 lg:col-span-4 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
            <div className="w-12 h-12 bg-gray-50 text-gray-600 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">notifications_active</span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">Alert Preferences</h3>
              <p className="text-xs text-gray-500 mt-1">Manage push, SMS, and email alerts.</p>
            </div>
            <div className="mt-auto pt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">All Alerts On</span>
              <span className="material-symbols-outlined text-[#0d631b] text-sm">
                arrow_forward
              </span>
            </div>
          </div>

          {/* Guardian Angel Card */}
          <Link
            to="/guardian"
            className="col-span-1 md:col-span-12 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-5 shadow-md flex items-center justify-between gap-4 hover:opacity-95 transition group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                <span
                  className="material-symbols-outlined text-white text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  security
                </span>
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">
                  {isGuardianAngel ? "Guardian Angel Dashboard" : "Become a Guardian Angel"}
                </h3>
                <p className="text-xs text-white/80 mt-0.5">
                  {isGuardianAngel
                    ? "Manage your availability and response history"
                    : "Volunteer to respond to nearby Layer 3 SOS alerts"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isGuardianAngel && (
                <span className="text-[9px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">
                  REGISTERED
                </span>
              )}
              <span className="material-symbols-outlined text-white group-hover:translate-x-0.5 transition-transform">
                arrow_forward
              </span>
            </div>
          </Link>
        </section>

        {/* System Actions */}
        <section className="flex flex-col gap-3.5 mt-2">
          <Link
            to="/support"
            className="w-full py-3.5 px-5 bg-white border border-gray-200 rounded-2xl flex items-center justify-between hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-gray-500">help</span>
              <span className="font-semibold text-sm text-gray-800">Help &amp; Support</span>
            </div>
            <span className="material-symbols-outlined text-gray-400">chevron_right</span>
          </Link>

          <button
            onClick={() => {
              logout();
              router.navigate({ to: "/login" });
            }}
            className="w-full py-3.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-2xl transition flex items-center justify-center gap-2 font-semibold text-sm"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            Log Out
          </button>
        </section>
      </main>
    </div>
  );
}
