import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { collection, query, where, getDocs, or } from "firebase/firestore";
import { db } from "../firebase/firebase";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [{ title: "TrustNet - Safety History" }],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      if (!user) return;
      try {
        const q = query(
          collection(db, "sos_sessions"),
          or(
            where("triggeredBy", "==", user.id),
            where("responderUID", "==", user.id)
          )
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Sort descending by startTime to avoid composite index requirement
        data.sort((a, b) => {
          const tA = a.startTime?.toMillis?.() || 0;
          const tB = b.startTime?.toMillis?.() || 0;
          return tB - tA;
        });
        
        setSessions(data);
      } catch (err) {
        console.error("Error fetching history:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [user]);

  const formatDate = (timestamp) => {
    if (!timestamp || !timestamp.toMillis) return "Unknown date";
    return new Date(timestamp.toMillis()).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getStatusColor = (session) => {
    if (session.status === "active") return "bg-red-500 border-red-200 animate-pulse";
    if (session.status === "cancelled") return "bg-gray-500 border-gray-200";
    return "bg-emerald-500 border-emerald-200";
  };
  
  const getTextColor = (session) => {
    if (session.status === "active") return "text-red-600";
    if (session.status === "cancelled") return "text-gray-600";
    return "text-emerald-700";
  };

  const getStatusTitle = (session) => {
    const isResponder = session.responderUID === user.id;
    if (isResponder) return "You Provided Assistance";
    if (session.status === "active") return "SOS Currently Active";
    if (session.status === "cancelled") return "SOS Cancelled";
    return "SOS Resolved / Ended";
  };

  const getStatusDescription = (session) => {
    const isResponder = session.responderUID === user.id;
    if (isResponder) return `You successfully helped resolve an emergency alert.`;
    if (session.status === "active") return `Alert escalated to Layer ${session.layerActive || 1}. Responders are being notified.`;
    if (session.responderName) return `Assistance provided by ${session.responderName}.`;
    return "Emergency broadcast was safely stood down.";
  };

  return (
    <div className="bg-[#faf9fc] text-gray-900 min-h-screen flex flex-col antialiased pb-20 md:pb-0">
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 md:pb-6 flex flex-col gap-6">
        {/* Header */}
        <div className="mb-2">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">Safety History</h1>
          <p className="text-sm text-gray-500">Review your historical safety tracking logs, active safe zones, and incident timelines.</p>
        </div>

        {/* Bento Stats Section */}
        <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 flex flex-col justify-between border border-gray-100 shadow-sm h-28 hover:-translate-y-0.5 transition-transform">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total SOS Alerts</span>
            <span className="text-3xl text-indigo-600 font-black">{sessions.filter(s => s.triggeredBy === user?.id).length}</span>
          </div>
          <div className="bg-white rounded-2xl p-5 flex flex-col justify-between border border-gray-100 shadow-sm h-28 hover:-translate-y-0.5 transition-transform">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assisted Incidents</span>
            <span className="text-3xl text-emerald-600 font-black">{sessions.filter(s => s.responderUID === user?.id).length}</span>
          </div>
          <div className="bg-white rounded-2xl p-5 flex flex-col justify-between border border-gray-100 shadow-sm h-28 hover:-translate-y-0.5 transition-transform col-span-2 md:col-span-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Days Protected</span>
            <span className="text-3xl text-purple-600 font-black">24/7</span>
          </div>
        </section>

        {/* Safety Timeline */}
        <section className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col gap-6 mt-2">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-50 pb-3">Recent Incident Log</h2>
          
          <div className="flex flex-col gap-8 relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-100">
            
            {loading && (
              <div className="animate-pulse flex space-x-4 ml-2">
                <div className="flex-1 space-y-4 py-1">
                  <div className="h-2 bg-gray-200 rounded w-3/4"></div>
                  <div className="space-y-2">
                    <div className="h-2 bg-gray-200 rounded"></div>
                    <div className="h-2 bg-gray-200 rounded w-5/6"></div>
                  </div>
                </div>
              </div>
            )}

            {!loading && sessions.length === 0 && (
              <div className="text-sm text-gray-500 ml-2 italic">No past SOS incidents found in your history. You've been safe!</div>
            )}

            {!loading && sessions.map((session, i) => (
              <div key={session.id} className="relative flex flex-col gap-1.5 hover:bg-gray-50 p-3 -ml-3 rounded-xl transition-colors group">
                {/* Timeline Dot */}
                <span className={`absolute left-[-15px] top-4 w-3.5 h-3.5 rounded-full border-[3px] border-white shadow-sm ${getStatusColor(session)}`}></span>
                
                <div className="flex justify-between items-start">
                  <h3 className={`text-sm font-bold ${getTextColor(session)}`}>{getStatusTitle(session)}</h3>
                  <span className="text-[11px] font-semibold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{formatDate(session.startTime)}</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed max-w-[90%]">
                  {getStatusDescription(session)}
                </p>
                <div className="flex gap-2 mt-2">
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-md">ID: {session.id.slice(0,6)}...</span>
                  {session.layerActive && (
                     <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md">Layer {session.layerActive}</span>
                  )}
                </div>
              </div>
            ))}
            
            {!loading && sessions.length > 0 && (
              <div className="relative flex flex-col gap-1 ml-2 mt-2">
                 <span className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-gray-200 border-2 border-white"></span>
                 <p className="text-xs text-gray-400 italic">End of history</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
