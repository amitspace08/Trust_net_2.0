import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";

import { db } from "../firebase/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs,
} from "firebase/firestore";
import { acceptRequest, rejectRequest } from "../services/trustService";
import { UserAvatar } from "../components/ui/UserAvatar";

export const Route = createFileRoute("/circle")({
  head: () => ({
    meta: [{ title: "TrustNet - My Trust Circle" }],
  }),
  component: TrustCirclePage,
});

// Helper for Haversine distance if needed (returns as string)
function formatDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  if (d < 1) {
    return `${Math.round(d * 1000)}m`;
  }
  return `${d.toFixed(1)}km`;
}

function TrustCirclePage() {
  const { user } = useAuth();
  const avatarUrl = user?.avatar || user?.profile_photo || "";
  const router = useRouter();

  const [contacts, setContacts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [layer2Contacts, setLayer2Contacts] = useState([]);
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Calculate Friends of Friends (Layer 2)
  useEffect(() => {
    if (!user || contacts.length === 0) return;

    async function fetchLayer2() {
      try {
        const l1Ids = contacts.map(c => c.id);
        const relRef = collection(db, "trust_relationships");
        const qAccepted = query(relRef, where("status", "==", "accepted"));
        const snap = await getDocs(qAccepted);

        const newL2 = {}; // uid -> Set of mutuals

        snap.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.userA === user.id || data.userB === user.id) return; // Ignore direct L1 relationships

          const isAL1 = l1Ids.includes(data.userA);
          const isBL1 = l1Ids.includes(data.userB);

          if (isAL1 && !isBL1) {
            if (!newL2[data.userB]) newL2[data.userB] = new Set();
            newL2[data.userB].add(data.userA);
          } else if (isBL1 && !isAL1) {
            if (!newL2[data.userA]) newL2[data.userA] = new Set();
            newL2[data.userA].add(data.userB);
          }
        });

        const l2List = [];
        for (const [uid, mutualSet] of Object.entries(newL2)) {
          const userDoc = await getDoc(doc(db, "users", uid));
          if (userDoc.exists()) {
            const uData = userDoc.data();
            
            // Respect Layer 2 Discoverability Privacy Setting
            if (uData.privacySettings && uData.privacySettings.layer2 === false) {
              continue;
            }
            
            l2List.push({
              id: uid,
              name: uData.name || uData.displayName || "User",
              avatar: uData.avatar || uData.profile_photo || "",
              mutualCount: mutualSet.size,
              score: Math.min(99, 65 + mutualSet.size * 12), // Dynamic score based on mutuals
              online: uData.online ?? false
            });
          }
        }

        // Sort by most mutual connections first, then score
        l2List.sort((a, b) => b.mutualCount - a.mutualCount || b.score - a.score);
        setLayer2Contacts(l2List.slice(0, 4)); // Show up to top 4 L2 contacts
      } catch (err) {
        console.error("Failed to fetch Layer 2 contacts:", err);
      }
    }
    fetchLayer2();
  }, [contacts, user]);

  const [guardianAngels, setGuardianAngels] = useState([]);

  // Fetch Nearby Guardian Angels
  useEffect(() => {
    if (!user) return;

    async function fetchGuardians() {
      try {
        const qGA = query(collection(db, "users"), where("isGuardianAngel", "==", true));
        const snap = await getDocs(qGA);

        let browserLat = 28.6139;
        let browserLng = 77.209;
        try {
          const rawLoc = localStorage.getItem("trustnet_browser_location");
          if (rawLoc) {
            const parsed = JSON.parse(rawLoc);
            browserLat = parsed.lat;
            browserLng = parsed.lng;
          }
        } catch {}

        const list = [];
        for (const d of snap.docs) {
          if (d.id === user.id) continue;
          const uData = d.data();

          const locRef = doc(db, "user_locations", d.id);
          const locSnap = await getDoc(locRef);
          if (locSnap.exists()) {
            const locData = locSnap.data();
            const cLat = locData?.geopoint?.latitude ?? locData?.latitude;
            const cLng = locData?.geopoint?.longitude ?? locData?.longitude;

            if (cLat && cLng) {
              const distanceStr = formatDistance(browserLat, browserLng, cLat, cLng);
              // formatDistance returns things like "450m" or "1.2km"
              const isMeters = distanceStr.endsWith("m") && !distanceStr.endsWith("km");
              let distanceKm = 999;
              if (isMeters) {
                distanceKm = parseInt(distanceStr.replace("m", "")) / 1000;
              } else {
                distanceKm = parseFloat(distanceStr.replace("km", ""));
              }

              // MUST BE <= 500 meters
              if (distanceKm <= 0.5) {
                list.push({
                  id: d.id,
                  name: uData.name || uData.displayName || "Guardian Angel",
                  avatar: uData.avatar || uData.profile_photo || "",
                  distanceStr,
                  online: uData.online ?? false,
                  distanceKm,
                });
              }
            }
          }
        }
        list.sort((a, b) => a.distanceKm - b.distanceKm);
        setGuardianAngels(list);
      } catch (err) {
        console.error("Error fetching Guardian Angels:", err);
      }
    }
    fetchGuardians();
  }, [user]);

  // 1. Listen for accepted contacts in Firestore
  useEffect(() => {
    if (!user) return;

    const qAccepted = query(
      collection(db, "trust_relationships"),
      where("status", "==", "accepted"),
    );

    const unsubscribe = onSnapshot(qAccepted, async (snapshot) => {
      try {
        const list = [];
        // Extract browser location for distance calculations
        let browserLat = 28.6139;
        let browserLng = 77.209;
        try {
          const rawLoc = localStorage.getItem("trustnet_browser_location");
          if (rawLoc) {
            const parsed = JSON.parse(rawLoc);
            browserLat = parsed.lat;
            browserLng = parsed.lng;
          }
        } catch {}

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          if (data.userA === user.id || data.userB === user.id) {
            const contactUid = data.userA === user.id ? data.userB : data.userA;

            // Get user profile
            const userRef = doc(db, "users", contactUid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const uData = userSnap.data();
              // Get user location
              const locRef = doc(db, "user_locations", contactUid);
              const locSnap = await getDoc(locRef);
              const locData = locSnap.exists() ? locSnap.data() : null;

              const cLat = locData?.geopoint?.latitude ?? locData?.latitude ?? 28.6139;
              const cLng = locData?.geopoint?.longitude ?? locData?.longitude ?? 77.209;
              const distStr =
                locData?.sharingEnabled !== false
                  ? formatDistance(browserLat, browserLng, cLat, cLng)
                  : "Unknown";

              list.push({
                id: contactUid,
                relationshipId: docSnap.id,
                name: uData.name || uData.displayName || "Contact",
                phone: uData.phone || uData.phone_no || "",
                relation: data.relation || "Friend",
                avatar: uData.avatar || uData.profile_photo || "",
                online: uData.online ?? true,
                status: data.inactive ? "Inactive" : "Active",
                at: data.createdAt?.seconds ? data.createdAt.seconds * 1000 : Date.now(),
                shareLocation: locData ? locData.sharingEnabled !== false : true,
                lastUpdated: locData?.timestamp?.toDate
                  ? locData.timestamp.toDate().toLocaleTimeString()
                  : "Just now",
                distance: distStr,
                latitude: cLat,
                longitude: cLng,
              });
            }
          }
        }
        setContacts(list);
      } catch (err) {
        console.error("Error subscribing to accepted contacts:", err);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // 2. Listen for pending trust requests in Firestore
  useEffect(() => {
    if (!user) return;

    const qPending = query(collection(db, "trust_relationships"), where("status", "==", "pending"));

    const unsubscribe = onSnapshot(qPending, async (snapshot) => {
      try {
        const list = [];
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();

          if (data.userB === user.id) {
            // Incoming request
            const senderRef = doc(db, "users", data.userA);
            const senderSnap = await getDoc(senderRef);
            if (senderSnap.exists()) {
              const sData = senderSnap.data();
              list.push({
                id: docSnap.id,
                name: sData.name || sData.displayName || "User",
                phone: sData.phone || sData.phone_no || "",
                relation: data.relation || "Friend",
                avatar: sData.avatar || sData.profile_photo || "",
                online: sData.online ?? true,
                type: "incoming",
                status: "Pending",
                at: data.createdAt?.seconds ? data.createdAt.seconds * 1000 : Date.now(),
              });
            }
          } else if (data.userA === user.id) {
            // Outgoing request
            const receiverRef = doc(db, "users", data.userB);
            const receiverSnap = await getDoc(receiverRef);
            if (receiverSnap.exists()) {
              const rData = receiverSnap.data();
              list.push({
                id: docSnap.id,
                name: rData.name || rData.displayName || "User",
                phone: rData.phone || rData.phone_no || "",
                relation: data.relation || "Friend",
                avatar: rData.avatar || rData.profile_photo || "",
                online: rData.online ?? true,
                type: "outgoing",
                status: "Pending",
                at: data.createdAt?.seconds ? data.createdAt.seconds * 1000 : Date.now(),
              });
            }
          }
        }
        setRequests(list);
      } catch (err) {
        console.error("Error subscribing to pending requests:", err);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Toggle Active/Inactive status in Firestore
  const toggleContactStatus = async (id) => {
    const contact = contacts.find((c) => c.id === id);
    if (!contact || !contact.relationshipId) return;
    try {
      const nextInactive = contact.status === "Active";
      await updateDoc(doc(db, "trust_relationships", contact.relationshipId), {
        inactive: nextInactive,
      });
      setActiveMenuId(null);
    } catch (err) {
      console.error("Failed to toggle contact status:", err);
    }
  };

  // Remove contact relationship from Firestore
  const removeContact = async (id) => {
    const contact = contacts.find((c) => c.id === id);
    if (!contact || !contact.relationshipId) return;
    try {
      await deleteDoc(doc(db, "trust_relationships", contact.relationshipId));
      setActiveMenuId(null);
    } catch (err) {
      console.error("Failed to remove contact:", err);
    }
  };

  // Accept incoming request in Firestore
  const handleAcceptRequest = async (reqId) => {
    try {
      await acceptRequest(reqId);
    } catch (err) {
      console.error("Failed to accept request:", err);
    }
  };

  // Reject incoming request in Firestore
  const handleRejectRequest = async (reqId) => {
    try {
      await rejectRequest(reqId);
    } catch (err) {
      console.error("Failed to reject request:", err);
    }
  };

  // Cancel outgoing request from Firestore
  const handleCancelRequest = async (reqId) => {
    try {
      await deleteDoc(doc(db, "trust_relationships", reqId));
    } catch (err) {
      console.error("Failed to cancel request:", err);
    }
  };

  // Clear processed request
  const handleDismissRequest = async (reqId) => {
    try {
      await deleteDoc(doc(db, "trust_relationships", reqId));
    } catch (err) {
      console.error("Failed to dismiss request:", err);
    }
  };

  const pendingRequests = requests.filter((r) => r.status === "Pending");
  const processedRequests = requests.filter((r) => r.status !== "Pending");

  return (
    <div className="w-full min-h-screen relative flex flex-col md:flex-row pb-24 md:pb-0 bg-[#faf9fc]">
      {/* Main Canvas */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6  pb-24 md:pb-6">
        {/* Title Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            My Trust Circle
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage the people who keep you safe and build your network.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Layer 1 Section */}
          <section className="lg:col-span-8 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">Direct Trusted Contacts</h2>
              <span className="text-xs font-semibold bg-[#0d631b]/10 text-[#0d631b] px-2.5 py-1 rounded-full">
                Layer 1
              </span>
            </div>

            {/* Contacts Container */}
            <div className="bg-white border border-gray-200/80 rounded-2xl p-4 flex flex-col gap-3.5 shadow-sm">
              {contacts.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">
                  No trusted contacts in your Circle yet.
                </div>
              ) : (
                contacts.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50/50 hover:border-gray-200/65 transition relative ${
                      c.status === "Inactive" ? "opacity-75" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      {/* Avatar with Online/Offline Indicator */}
                      <div className="relative">
                        <UserAvatar
                          name={c.name}
                          avatarUrl={c.avatar}
                          sizeClassName="w-12 h-12 text-base font-semibold"
                          className={`border-2 ${
                            c.status === "Active"
                              ? "border-[#0d631b]/30"
                              : "border-gray-200 grayscale"
                          }`}
                        />

                        {/* Visual indicator of online status */}
                        <span
                          className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
                            c.online ? "bg-green-500" : "bg-gray-400"
                          }`}
                          title={c.online ? "Online" : "Offline"}
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 flex items-center gap-1.5">
                          {c.name}
                          <span className="text-[11px] font-normal text-gray-400">
                            ({c.relation})
                          </span>
                        </h3>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <span className="material-symbols-outlined text-[14px]">call</span>
                          {c.phone}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Status pill */}
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 ${
                          c.status === "Active"
                            ? "bg-[#0d631b]/10 text-[#0d631b]"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${c.status === "Active" ? "bg-[#0d631b]" : "bg-gray-400"}`}
                        ></span>
                        {c.status}
                      </span>

                      {/* Dropdown Menu */}
                      <div className="relative">
                        <button
                          onClick={() => setActiveMenuId(activeMenuId === c.id ? null : c.id)}
                          className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition"
                        >
                          <span className="material-symbols-outlined">more_vert</span>
                        </button>
                        {activeMenuId === c.id && (
                          <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 z-20">
                            <button
                              onClick={() => toggleContactStatus(c.id)}
                              className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 font-medium flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-sm">
                                {c.status === "Active" ? "toggle_off" : "toggle_on"}
                              </span>
                              Set {c.status === "Active" ? "Inactive" : "Active"}
                            </button>
                            <button
                              onClick={() => removeContact(c.id)}
                              className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 font-medium flex items-center gap-2 border-t border-gray-100"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                              Remove Contact
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Add Contact Button */}
              <Link
                to="/add-contact"
                className="w-full py-3 mt-1 border-2 border-dashed border-[#0d631b]/30 hover:border-[#0d631b]/50 rounded-xl text-[#0d631b] font-semibold text-sm hover:bg-[#0d631b]/5 transition flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">person_add</span>
                Add Contact
              </Link>
            </div>

            {/* Pending Requests & Contact Request UI (States: Pending, Accepted, Rejected) */}
            <div className="mt-2">
              <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                Pending Circle Requests
                {pendingRequests.length > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                    {pendingRequests.length}
                  </span>
                )}
              </h3>

              <div className="flex flex-col gap-2.5">
                {requests.length === 0 && (
                  <p className="text-xs text-gray-400 bg-white border border-gray-200 rounded-xl p-4 text-center">
                    No pending invites or request actions.
                  </p>
                )}

                {requests.map((r) => {
                  if (r.status === "Pending") {
                    return (
                      <div
                        key={r.id}
                        className="bg-white border border-gray-200 rounded-xl p-3.5 flex items-center justify-between shadow-sm border-l-4 border-amber-400"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <UserAvatar
                              name={r.name}
                              avatarUrl={r.avatar}
                              sizeClassName="w-10 h-10 text-xs font-semibold"
                              className="border border-gray-100"
                            />

                            <span
                              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${
                                r.online ? "bg-green-500" : "bg-gray-400"
                              }`}
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-gray-900">
                              {r.name}
                              <span className="text-[10px] ml-1.5 text-gray-400 font-normal bg-gray-100 px-1.5 py-0.5 rounded">
                                {r.relation}
                              </span>
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {r.type === "incoming"
                                ? "Wants to join your circle"
                                : "Awaiting Acceptance"}
                            </p>
                          </div>
                        </div>

                        {r.type === "incoming" ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAcceptRequest(r.id)}
                              className="bg-[#0d631b] hover:bg-[#0a5215] text-white text-xs font-bold px-3 py-1.5 rounded-full transition shadow-sm"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleRejectRequest(r.id)}
                              className="border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold px-3 py-1.5 rounded-full transition"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleCancelRequest(r.id)}
                            className="text-xs text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    );
                  } else {
                    // Accepted or Rejected states UI
                    return (
                      <div
                        key={r.id}
                        className={`bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between shadow-sm opacity-80 ${
                          r.status === "Accepted"
                            ? "border-l-4 border-[#0d631b]"
                            : "border-l-4 border-red-400"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={r.name}
                            avatarUrl={r.avatar}
                            sizeClassName="w-8 h-8 text-[10px] font-bold"
                            className="grayscale"
                          />

                          <div>
                            <p className="font-semibold text-xs text-gray-700">{r.name}</p>
                            <p className="text-[10px] text-gray-400">Request {r.status}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              r.status === "Accepted"
                                ? "bg-green-150 text-[#0d631b]"
                                : "bg-red-100 text-red-600"
                            }`}
                          >
                            {r.status}
                          </span>
                          <button
                            onClick={() => handleDismissRequest(r.id)}
                            className="text-gray-400 hover:text-gray-600"
                            title="Dismiss notification"
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            </div>
          </section>

          {/* Desktop Right Side Panel: L2 Info & Friends of Friends */}
          <section className="lg:col-span-4 flex flex-col gap-4">
            {/* Info Banner */}
            <div className="bg-[#54a0fe]/10 border border-[#54a0fe]/20 rounded-2xl p-4 flex gap-3 items-start">
              <span className="material-symbols-outlined text-[#005faf] mt-0.5">info</span>
              <div>
                <h3 className="font-bold text-sm text-[#003567] mb-1">Layer 2 Explained</h3>
                <p className="text-xs text-[#003567] leading-relaxed">
                  Friends of Friends form your extended safety net. They are vetted by your direct
                  contacts, expanding your safe zones.
                </p>
              </div>
            </div>

            {/* Layer 2 Contacts */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-3 shadow-sm">
              <div className="flex justify-between items-center mb-1">
                <h2 className="text-base font-bold text-gray-900">Friends of Friends</h2>
                <span className="text-[10px] font-semibold bg-[#54a0fe]/10 text-[#005faf] px-2 py-0.5 rounded-full">
                  Layer 2
                </span>
              </div>

              {layer2Contacts.length === 0 ? (
                <p className="text-xs text-gray-400 bg-gray-50/50 border border-gray-100 rounded-xl p-4 text-center">
                  No friends of friends found yet. Expand your network!
                </p>
              ) : (
                layer2Contacts.map((l2) => (
                  <div key={l2.id} className="p-3 bg-gray-50/50 hover:bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between transition">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <UserAvatar
                          name={l2.name}
                          avatarUrl={l2.avatar}
                          sizeClassName="w-10 h-10 text-xs font-bold"
                          className="border border-gray-100"
                        />

                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
                          <span className="material-symbols-outlined text-[10px] text-white bg-[#005faf] rounded-full p-0.5">
                            verified
                          </span>
                        </div>
                        {/* Visual indicator of online status */}
                        <span
                          className={`absolute -top-0.5 -left-0.5 w-2.5 h-2.5 rounded-full border border-white ${l2.online ? "bg-green-500" : "bg-gray-400"}`}
                          title={l2.online ? "Online" : "Offline"}
                        />
                      </div>
                      <div>
                        <h4 className="font-semibold text-xs text-gray-900">{l2.name}</h4>
                        <p className="text-[10px] text-gray-400 flex items-center gap-0.5 mt-0.5">
                          <span className="material-symbols-outlined text-[12px]">group</span>
                          {l2.mutualCount} mutual{l2.mutualCount > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-bold text-xs text-[#0d631b]">{l2.score}%</span>
                      <span className="text-[9px] text-gray-400">Trust Score</span>
                    </div>
                  </div>
                ))
              )}

              {/* Invite Button */}
              <button className="mt-2 w-full bg-[#0d631b] text-white text-xs font-semibold py-3 rounded-xl hover:bg-[#0a5215] transition-all flex items-center justify-center gap-2 shadow-sm">
                <span className="material-symbols-outlined text-sm">share</span>
                Invite Friends to Network
              </button>
            </div>

            {/* Layer 3 - Guardian Angels (Nearby within 500m) */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-3 shadow-sm mt-1">
              <div className="flex justify-between items-center mb-1">
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-amber-500 text-lg">security</span>
                  Guardian Angels
                </h2>
                <span className="text-[10px] font-semibold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-100">
                  Layer 3
                </span>
              </div>
              <p className="text-[10px] text-gray-500 leading-tight mb-1">
                Community volunteers within a 500m radius ready to help in severe emergencies.
              </p>

              {guardianAngels.length === 0 ? (
                <p className="text-xs text-gray-400 bg-gray-50/50 border border-gray-100 rounded-xl p-4 text-center">
                  No active Guardian Angels within 500m.
                </p>
              ) : (
                guardianAngels.map((ga) => (
                  <div key={ga.id} className="p-3 bg-amber-50/30 border border-amber-100 rounded-xl flex items-center justify-between transition">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <UserAvatar
                          name={ga.name}
                          avatarUrl={ga.avatar}
                          sizeClassName="w-10 h-10 text-xs font-bold"
                          className="border border-amber-200"
                        />
                        <span
                          className={`absolute -top-0.5 -left-0.5 w-2.5 h-2.5 rounded-full border border-white ${ga.online ? "bg-green-500" : "bg-gray-400"}`}
                          title={ga.online ? "Online" : "Offline"}
                        />
                      </div>
                      <div>
                        <h4 className="font-semibold text-xs text-gray-900">{ga.name}</h4>
                        <p className="text-[10px] text-amber-700 font-medium flex items-center gap-0.5 mt-0.5">
                          <span className="material-symbols-outlined text-[12px]">verified</span>
                          Verified Guardian
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-bold text-xs text-amber-600">{ga.distanceStr}</span>
                      <span className="text-[9px] text-gray-400">Distance</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
