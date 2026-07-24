import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db } from "../firebase/firebase";
import { collection, getDocs } from "firebase/firestore";

export const Route = createFileRoute("/debug-users")({
  head: () => ({ meta: [{ title: "TrustNet — Registered Users Debug" }] }),
  component: DebugUsersPage,
});

function DebugUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const usersRef = collection(db, "users");
        const snap = await getDocs(usersRef);
        const list = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsers(list);
      } catch (err) {
        console.error("Failed to fetch debug users:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  return (
    <div className="min-h-screen bg-[#faf9fc] p-6">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-7">
        <div className="flex items-center gap-2 mb-6">
          <Link to="/" className="material-symbols-outlined text-gray-700 hover:bg-gray-100 p-1.5 rounded-full transition">
            arrow_back
          </Link>
          <span className="text-xl font-bold text-gray-900">Registered Firestore Users</span>
        </div>

        {loading ? (
          <div className="text-center py-10">
            <span className="w-6 h-6 rounded-full border-2 border-gray-300 border-t-[#0d631b] animate-spin inline-block" />
            <p className="text-xs text-gray-500 mt-2">Loading users from Firestore...</p>
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-10">No users found in the "users" collection.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-gray-500 mb-2">
              Here is the list of all registered users in your Firestore database. Copy an email below and paste it into the search box on the "Add Contact" page.
            </p>
            {users.map((u, i) => (
              <div key={u.id || i} className="border border-gray-150 rounded-xl p-3 bg-gray-50 flex flex-col gap-1">
                <p className="text-xs font-semibold text-gray-900">
                  Name: <span className="font-normal text-gray-700">{u.name || u.displayName || "N/A"}</span>
                </p>
                <p className="text-xs font-semibold text-gray-900">
                  Email (field `email`): <span className="font-normal text-gray-700">{u.email || "N/A"}</span>
                </p>
                <p className="text-xs font-semibold text-gray-900">
                  Email (field `email_id`): <span className="font-normal text-gray-700">{u.email_id || "N/A"}</span>
                </p>
                <p className="text-xs font-semibold text-gray-900">
                  Phone (field `phone_no`): <span className="font-normal text-gray-700">{u.phone_no || "N/A"}</span>
                </p>
                <p className="text-xs font-semibold text-gray-900">
                  UID: <span className="font-normal text-gray-500 select-all">{u.id || u.uid}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
