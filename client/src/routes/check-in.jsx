import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/check-in")({
  head: () => ({ meta: [{ title: "TrustNet — Check In" }] }),
  component: CheckInPage,
});

function CheckInPage() {
  const router = useRouter();
  const [list, setList] = useState([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    try {
      setList(JSON.parse(localStorage.getItem("trustnet_checkins") || "[]"));
    } catch (err) {
      console.warn("Failed to load checkins from localStorage", err);
    }
  }, []);

  function checkIn(status) {
    const next = [{ id: crypto.randomUUID(), status, note, at: Date.now() }, ...list].slice(0, 20);
    setList(next);
    localStorage.setItem("trustnet_checkins", JSON.stringify(next));
    setNote("");
    if (status === "safe") setTimeout(() => router.navigate({ to: "/" }), 800);
  }

  const fmt = (t) => new Date(t).toLocaleString();

  return (
    <div className="min-h-screen bg-[#faf9fc] pb-24 md:pb-8">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200 flex items-center gap-3 px-4 h-14">
        <Link to="/" className="material-symbols-outlined text-gray-700">
          arrow_back
        </Link>
        <h1 className="text-base font-semibold flex-1">Safety check-in</h1>
      </header>
      <div className="max-w-md md:max-w-2xl mx-auto p-4 flex flex-col gap-5">
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-sm text-gray-700 font-medium">
            Let your circle know how you're doing.
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Optional message (e.g. heading home)"
            className="mt-3 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />

          <div className="grid grid-cols-3 gap-2 mt-3">
            <button
              onClick={() => checkIn("safe")}
              className="bg-[#0d631b] text-white font-semibold py-2.5 rounded-full text-sm"
            >
              I'm safe
            </button>
            <button
              onClick={() => checkIn("leaving")}
              className="bg-amber-500 text-white font-semibold py-2.5 rounded-full text-sm"
            >
              Heading out
            </button>
            <button
              onClick={() => checkIn("arrived")}
              className="bg-blue-600 text-white font-semibold py-2.5 rounded-full text-sm"
            >
              Arrived
            </button>
          </div>
        </div>

        <section>
          <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
            History
          </p>
          {list.length === 0 && <p className="text-sm text-gray-500">No check-ins yet.</p>}
          <div className="flex flex-col gap-2">
            {list.map((e) => (
              <div key={e.id} className="bg-white border border-gray-200 rounded-2xl p-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold uppercase tracking-wider ${
                      e.status === "safe"
                        ? "text-[#0d631b]"
                        : e.status === "leaving"
                          ? "text-amber-600"
                          : "text-blue-600"
                    }`}
                  >
                    {e.status}
                  </span>
                  <span className="text-[11px] text-gray-400">{fmt(e.at)}</span>
                </div>
                {e.note && <p className="text-sm text-gray-700 mt-1">{e.note}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
