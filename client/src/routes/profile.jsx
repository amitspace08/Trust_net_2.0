import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { stopSharing, updateMyLocation } from "../services/locationService";
import { UserAvatar } from "../components/ui/UserAvatar";
import { collection, query, where, onSnapshot, getDoc, doc } from "firebase/firestore";
import { db } from "../firebase/firebase";

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
  const [contacts, setContacts] = useState([]);
  const [trustScore, setTrustScore] = useState(70);

  // Photo editing state
  const [editingPhoto, setEditingPhoto] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoSaved, setPhotoSaved] = useState(false);

  const handleSavePhoto = async () => {
    const url = newPhotoUrl.trim();
    if (!url) return;
    setPhotoSaving(true);
    try {
      if (user?.id) {
        const { updateDoc, doc } = await import("firebase/firestore");
        await updateDoc(doc(db, "users", user.id), { photoURL: url, profile_photo: url });
      }
      const raw = localStorage.getItem("trustnet_auth_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.avatar = url;
        parsed.profile_photo = url;
        localStorage.setItem("trustnet_auth_user", JSON.stringify(parsed));
      }
      setPhotoSaved(true);
      setEditingPhoto(false);
      setNewPhotoUrl("");
      setTimeout(() => setPhotoSaved(false), 2500);
    } catch (e) {
      console.error("Photo update failed:", e);
    }
    setPhotoSaving(false);
  };

  // Fetch Real Profile Data (Contacts, Score, Guardian Status)
  useEffect(() => {
    if (!user) return;

    // Listen to real-time user doc for Guardian status
    const unsubUser = onSnapshot(doc(db, "users", String(user.id)), (snap) => {
      if (snap.exists()) {
        setIsGuardianAngel(snap.data().isGuardianAngel === true);
      }
    });

    // Fetch real trusted contacts
    const qAccepted = query(
      collection(db, "trust_relationships"),
      where("status", "==", "accepted")
    );
    const unsubContacts = onSnapshot(qAccepted, async (snapshot) => {
      const list = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        if (data.userA === user.id || data.userB === user.id) {
          const partnerId = data.userA === user.id ? data.userB : data.userA;
          const userRef = doc(db, "users", partnerId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const uData = userSnap.data();
            list.push({
              id: partnerId,
              name: uData.name || uData.displayName || "Contact",
              avatar: uData.avatar || uData.profile_photo || ""
            });
          }
        }
      }
      setContacts(list);
      setTrustScore(Math.min(99, 70 + (list.length * 5)));
    });

    return () => {
      unsubUser();
      unsubContacts();
    };
  }, [user]);

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
            },
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
      {/* Main Content Area */}
      <main className="flex-grow w-full max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-6 flex flex-col gap-6">
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
            <button
              onClick={() => {
                setEditingPhoto(true);
                setNewPhotoUrl(avatarUrl);
              }}
              className="absolute -bottom-2 right-2 md:-bottom-2 md:right-4 bg-[#0d631b] text-white w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border-2 border-white shadow-md hover:bg-[#0a5015] transition"
              title="Change profile photo"
            >
              <span className="material-symbols-outlined text-sm md:text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                photo_camera
              </span>
            </button>

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
          {photoSaved && (
            <span className="text-[10px] text-emerald-600 font-bold animate-bounce">
              Photo updated!
            </span>
          )}
          {editingPhoto && (
            <div className="w-full max-w-xs flex flex-col gap-2 bg-white border border-gray-200 rounded-2xl p-4 shadow-md">
              <p className="text-xs font-bold text-gray-700">Paste a photo URL</p>
              {newPhotoUrl && (
                <img
                  src={newPhotoUrl}
                  alt="Preview"
                  className="w-12 h-12 rounded-full object-cover border mx-auto"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
              <input
                type="url"
                value={newPhotoUrl}
                onChange={(e) => setNewPhotoUrl(e.target.value)}
                placeholder="https://example.com/photo.jpg"
                className="border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0d631b]/40"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setEditingPhoto(false)}
                  className="flex-1 text-xs py-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePhoto}
                  disabled={photoSaving || !newPhotoUrl.trim()}
                  className="flex-1 text-xs py-2 rounded-xl bg-[#0d631b] text-white font-bold disabled:opacity-50 transition"
                >
                  {photoSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}
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
                <span className="text-3xl font-extrabold text-[#0d631b] block">{trustScore}</span>
                <span className="text-[10px] font-bold text-[#0d631b] bg-[#0d631b]/10 px-2 py-0.5 rounded-full mt-1 inline-block">
                  {trustScore >= 90 ? "Excellent" : trustScore >= 80 ? "Great" : "Good"}
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
                className="w-full bg-[#0d631b] rounded-t-sm shadow-sm transition-all duration-1000"
                style={{ height: `${trustScore}%` }}
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
              {contacts.slice(0, 3).map((c, i) => (
                <div key={c.id || i} className="w-7 h-7 rounded-full border-2 border-white overflow-hidden shadow-sm">
                  <UserAvatar
                    name={c.name}
                    avatarUrl={c.avatar}
                    sizeClassName="w-full h-full text-[9px] font-bold"
                  />
                </div>
              ))}
              {contacts.length > 3 && (
                <div className="w-7 h-7 rounded-full bg-gray-150 border-2 border-white flex items-center justify-center text-[9px] font-bold text-gray-600 shadow-sm z-10">
                  +{contacts.length - 3}
                </div>
              )}
              {contacts.length === 0 && (
                <div className="w-7 h-7 rounded-full bg-gray-50 border-2 border-white flex items-center justify-center text-xs text-gray-400 shadow-sm">
                  <span className="material-symbols-outlined text-xs">add</span>
                </div>
              )}
            </div>
          </Link>

          {/* Alert Preferences */}
          <Link
            to="/settings"
            className="col-span-1 md:col-span-6 lg:col-span-4 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4 hover:border-gray-300 transition group"
          >
            <div className="w-12 h-12 bg-gray-50 text-gray-600 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-xl">notifications_active</span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">Alert Preferences</h3>
              <p className="text-xs text-gray-500 mt-1">Manage push, SMS, and email alerts.</p>
            </div>
            <div className="mt-auto pt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">{
                (() => {
                  try {
                    const raw = localStorage.getItem("trustnet_prefs");
                    if (raw) {
                       const p = JSON.parse(raw);
                       if (p.notifyIncidents === false && p.notifyCircle === false) return "All Alerts Off";
                       if (p.notifyIncidents === false || p.notifyCircle === false) return "Custom Alerts";
                    }
                  } catch {}
                  return "All Alerts On";
                })()
              }</span>
              <span className="material-symbols-outlined text-[#0d631b] text-sm group-hover:translate-x-0.5 transition-transform">
                arrow_forward
              </span>
            </div>
          </Link>

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
                    ? "Manage your availability and respond to emergencies."
                    : "Volunteer to respond to nearby Layer 3 SOS alerts."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isGuardianAngel && (
                <span className="text-[9px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full border border-white/40">
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
