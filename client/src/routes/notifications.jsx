import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { subscribeToNotifications } from "../services/notificationListener";
import { markNotificationRead } from "../services/readNotification";
import { db } from "../firebase/firebase";
import { doc, deleteDoc, writeBatch, getDocs, collection, query, where } from "firebase/firestore";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "TrustNet — Notifications" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToNotifications(user.id, (data) => {
      const mapped = data.map((n) => {
        let icon = "info";
        let tone = "info";

        if (n.type === "SOS" || n.type?.includes("SOS")) {
          icon = "warning";
          tone = "warn";
        } else if (n.type === "trust_accept") {
          icon = "verified_user";
          tone = "ok";
        } else if (n.type === "trust_request") {
          icon = "group_add";
          tone = "info";
        }

        let timeStr = "Just now";
        if (n.createdAt) {
          const date = n.createdAt.toDate
            ? n.createdAt.toDate()
            : new Date(n.createdAt.seconds * 1000);
          const diffMs = Date.now() - date.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          if (diffMins < 1) timeStr = "Just now";
          else if (diffMins < 60) timeStr = `${diffMins}m`;
          else {
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) timeStr = `${diffHours}h`;
            else timeStr = date.toLocaleDateString();
          }
        }

        return {
          id: n.id,
          icon,
          title: n.title || "Notification",
          body: n.message || "",
          time: timeStr,
          tone,
          deepLink: n.deepLink,
        };
      });
      setItems(mapped);

      // Auto-mark notifications as read when viewed
      data.forEach((n) => {
        if (!n.read) {
          markNotificationRead(n.id).catch(console.error);
        }
      });
    });

    return () => unsubscribe();
  }, [user]);

  const clear = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, "notifications"), where("receiverUID", "==", user.id));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to clear notifications:", err);
    }
  };

  const dismissItem = async (id) => {
    try {
      await deleteDoc(doc(db, "notifications", id));
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9fc] pb-24 md:pb-8">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200 flex items-center gap-3 px-4 h-14">
        <Link to="/" className="material-symbols-outlined text-gray-700">
          arrow_back
        </Link>
        <h1 className="text-base font-semibold flex-1">Notifications</h1>
        <button onClick={clear} className="text-xs font-medium text-[#0d631b]">
          Clear all
        </button>
      </header>
      <div className="max-w-md md:max-w-5xl mx-auto p-4 flex flex-col gap-3">
        {items.length === 0 && (
          <div className="text-center text-sm text-gray-500 py-16">You're all caught up.</div>
        )}
        {items.map((n) => {
          const content = (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex gap-3 hover:bg-gray-50 transition cursor-pointer">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  n.tone === "warn"
                    ? "bg-red-100 text-red-600"
                    : n.tone === "ok"
                      ? "bg-green-100 text-[#0d631b]"
                      : "bg-blue-100 text-blue-600"
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                  {n.icon}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold text-sm text-gray-900 truncate">{n.title}</p>
                  <span className="text-[11px] text-gray-400 shrink-0">{n.time}</span>
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{n.body}</p>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  dismissItem(n.id);
                }}
                className="material-symbols-outlined text-gray-400 self-start"
                style={{ fontSize: 18 }}
                aria-label="Dismiss"
              >
                close
              </button>
            </div>
          );

          return n.deepLink ? (
            <Link key={n.id} to={n.deepLink} className="block">
              {content}
            </Link>
          ) : (
            <div key={n.id}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
