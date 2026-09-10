import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "TrustNet — Settings" }] }),
  component: SettingsPage,
});

const DEFAULTS = {
  shareLocation: true,
  notifyIncidents: true,
  notifyCircle: true,
  hapticSOS: true,
  darkMode: false,
};

function SettingsPage() {
  const { user, logout } = useAuth();
  const [prefs, setPrefs] = useState(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("trustnet_prefs");
      if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch (err) {
      console.warn("Failed to load preferences from localStorage", err);
    }
  }, []);

  function update(key, value) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    localStorage.setItem("trustnet_prefs", JSON.stringify(next));

    if (key === "darkMode") {
      if (value) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    }
  }

  const rows = [
    {
      key: "shareLocation",
      label: "Share live location",
      desc: "Allow circle members to see your location.",
    },
    { key: "notifyIncidents", label: "Incident alerts", desc: "Be notified of nearby incidents." },
    {
      key: "notifyCircle",
      label: "Circle updates",
      desc: "Notifications from your safety circle.",
    },
    {
      key: "hapticSOS",
      label: "SOS haptic feedback",
      desc: "Vibrate while holding the SOS button.",
    },
    { key: "darkMode", label: "Dark mode", desc: "Use a dark theme (preview)." },
  ];

  return (
    <div className="min-h-screen bg-[#faf9fc] pb-24 md:pb-8">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200 flex items-center gap-3 px-4 h-14">
        <Link to="/profile" className="material-symbols-outlined text-gray-700">
          arrow_back
        </Link>
        <h1 className="text-base font-semibold flex-1">Settings</h1>
      </header>
      <div className="max-w-md md:max-w-2xl mx-auto p-4 flex flex-col gap-6">
        <section className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Account</p>
          <p className="mt-2 text-base font-semibold text-gray-900">{user?.name}</p>
          <p className="text-sm text-gray-500">{user?.email}</p>
          <div className="flex gap-2 mt-3">
            <Link
              to="/profile"
              className="flex-1 text-center text-sm font-medium border border-gray-300 rounded-full py-2"
            >
              Edit profile
            </Link>
            <button
              onClick={logout}
              className="flex-1 text-sm font-medium border border-red-200 text-red-600 rounded-full py-2"
            >
              Log out
            </button>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          {rows.map((r) => (
            <div key={r.key} className="flex items-start justify-between gap-4 p-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{r.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
              </div>
              <button
                role="switch"
                aria-checked={prefs[r.key]}
                onClick={() => update(r.key, !prefs[r.key])}
                className={`w-11 h-6 rounded-full relative transition ${prefs[r.key] ? "bg-[#0d631b]" : "bg-gray-300"}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ${prefs[r.key] ? "translate-x-5" : ""}`}
                />
              </button>
            </div>
          ))}
        </section>

        <p className="text-center text-[11px] text-gray-400">TrustNet · v1.0 (demo)</p>
      </div>
    </div>
  );
}
