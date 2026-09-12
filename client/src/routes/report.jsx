import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/report")({
  head: () => ({ meta: [{ title: "TrustNet — Report Incident" }] }),
  component: ReportPage,
});

const TYPES = [
  { id: "suspicious", icon: "visibility", label: "Suspicious activity" },
  { id: "harassment", icon: "report", label: "Harassment" },
  { id: "theft", icon: "shopping_bag", label: "Theft" },
  { id: "unsafe", icon: "warning", label: "Unsafe area" },
  { id: "accident", icon: "local_hospital", label: "Accident" },
  { id: "other", icon: "more_horiz", label: "Other" },
];

function ReportPage() {
  const router = useRouter();
  const [type, setType] = useState("suspicious");
  const [location, setLocation] = useState("Current location");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);

  function submit(e) {
    e.preventDefault();
    const raw = localStorage.getItem("trustnet_reports");
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({ id: crypto.randomUUID(), type, location, note, at: Date.now() });
    localStorage.setItem("trustnet_reports", JSON.stringify(list.slice(0, 50)));
    setDone(true);
    setTimeout(() => router.navigate({ to: "/heatmap" }), 1200);
  }

  return (
    <div className="min-h-screen bg-[#faf9fc] pb-24 md:pb-8">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200 flex items-center gap-3 px-4 h-14">
        <Link to="/heatmap" className="material-symbols-outlined text-gray-700">
          arrow_back
        </Link>
        <h1 className="text-base font-semibold flex-1">Report incident</h1>
      </header>
      <form onSubmit={submit} className="max-w-md md:max-w-5xl mx-auto p-4 flex flex-col gap-5">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Type</p>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className={`flex flex-col items-center gap-1 p-3 rounded-2xl border ${type === t.id ? "border-[#0d631b] bg-[#e6f3e9] text-[#0d631b]" : "border-gray-200 bg-white text-gray-700"}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
                  {t.icon}
                </span>
                <span className="text-[11px] text-center leading-tight">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Location
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          What happened?
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="Add details to help the community stay safe…"
            className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
          />
        </label>
        <button
          type="submit"
          disabled={done}
          className="bg-[#0d631b] text-white font-semibold py-3 rounded-full active:scale-[0.98] transition disabled:opacity-60"
        >
          {done ? "Reported ✓" : "Submit report"}
        </button>
        <p className="text-xs text-gray-500 text-center">
          Reports are anonymous and shared with your circle.
        </p>
      </form>
    </div>
  );
}
