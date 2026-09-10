import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { db } from "../firebase/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  getDoc,
} from "firebase/firestore";
import { UserAvatar } from "../components/ui/UserAvatar";

export const Route = createFileRoute("/add-contact")({
  head: () => ({ meta: [{ title: "TrustNet — Add Contact" }] }),
  component: AddContactPage,
});

function AddContactPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [searched, setSearched] = useState(false);
  const [customRelation, setCustomRelation] = useState("Friend");
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [contacts, setContacts] = useState([]);

  // 1. Sync current contacts from Firestore trust_relationships
  useEffect(() => {
    if (!user) return;

    const qAccepted = query(
      collection(db, "trust_relationships"),
      where("status", "==", "accepted"),
    );

    const unsubscribe = onSnapshot(qAccepted, async (snapshot) => {
      try {
        const list = [];
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          if (data.userA === user.id || data.userB === user.id) {
            const contactUid = data.userA === user.id ? data.userB : data.userA;

            const userRef = doc(db, "users", contactUid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const uData = userSnap.data();
              list.push({
                id: contactUid,
                relationshipId: docSnap.id,
                name: uData.name || uData.displayName || "Contact",
                phone: uData.phone || uData.phone_no || "",
                relation: data.relation || "Friend",
                avatar: uData.avatar || uData.profile_photo || "",
                online: uData.online ?? true,
                status: "Active",
              });
            }
          }
        }
        setContacts(list);
      } catch (err) {
        console.error("[TrustNet Debug] Subscribing to contacts failed:", err);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // 2. Lookup phone number or email in Firestore users collection
  async function handleSearchSubmit(e) {
    e.preventDefault();
    const queryStr = searchQuery.trim().toLowerCase();
    if (!queryStr) return;

    setSearching(true);
    setSearched(false);
    setSearchResult(null);
    setInviteSuccess(false);
    setInviteError(null);

    console.log(`[TrustNet Debug] Lookup user by query: "${queryStr}"`);

    try {
      const usersRef = collection(db, "users");
      let snap;

      if (queryStr.includes("@")) {
        // Query by email
        const q1 = query(usersRef, where("email", "==", queryStr));
        const q2 = query(usersRef, where("email_id", "==", queryStr));
        const [res1, res2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        snap = !res1.empty ? res1 : res2;
      } else {
        // Query by phone
        const q = query(usersRef, where("phone_no", "==", queryStr));
        snap = await getDocs(q);
      }

      if (snap.empty) {
        console.log(
          `[TrustNet Debug] Lookup result: No registered user found matching query: "${queryStr}"`,
        );
        setSearchResult(null);
      } else {
        const foundDoc = snap.docs[0];
        const fData = foundDoc.data();
        console.log(
          `[TrustNet Debug] Lookup result: Found matching user! UID: "${foundDoc.id}", Name: "${fData.name || fData.displayName}"`,
        );

        // Check if there is already a relationship in trust_relationships
        const relRef = collection(db, "trust_relationships");
        const qRel1 = query(
          relRef,
          where("userA", "==", user.id),
          where("userB", "==", foundDoc.id),
        );
        const qRel2 = query(
          relRef,
          where("userA", "==", foundDoc.id),
          where("userB", "==", user.id),
        );

        const [snap1, snap2] = await Promise.all([getDocs(qRel1), getDocs(qRel2)]);
        let relationshipStatus = "None";
        let relationshipId = "";

        if (!snap1.empty) {
          relationshipStatus = snap1.docs[0].data().status;
          relationshipId = snap1.docs[0].id;
        } else if (!snap2.empty) {
          relationshipStatus = snap2.docs[0].data().status;
          relationshipId = snap2.docs[0].id;
        }

        setSearchResult({
          id: foundDoc.id,
          name: fData.name || fData.displayName || "User",
          email: fData.email || fData.email_id || "",
          phone: fData.phone_no || "",
          avatar: fData.photoURL || fData.profile_photo || "",
          relationshipStatus,
          relationshipId,
        });
      }
      setSearched(true);
    } catch (err) {
      console.error("[TrustNet Debug] Search failed:", err);
      setInviteError("Failed to search. Please check your network connection.");
    } finally {
      setSearching(false);
    }
  }

  // 3. Create real Firestore trust invitation
  async function handleSendInvite() {
    if (!user || !searchResult || sendingInvite) return;

    setSendingInvite(true);
    setInviteSuccess(false);
    setInviteError(null);

    console.log(
      `[TrustNet Debug] Creating invitation. SenderId: "${user.id}", ReceiverId: "${searchResult.id}", Status: "pending", Relation: "${customRelation}"`,
    );

    try {
      const relRef = collection(db, "trust_relationships");
      const docRef = await addDoc(relRef, {
        userA: user.id,
        userB: searchResult.id,
        status: "pending",
        relation: customRelation,
        createdAt: serverTimestamp(),
      });

      console.log(`[TrustNet Debug] Invitation created successfully! DocID: "${docRef.id}"`);

      // Write notification
      try {
        const notificationsRef = collection(db, "notifications");
        await addDoc(notificationsRef, {
          receiverUID: searchResult.id,
          senderUID: user.id,
          receiver: searchResult.id,
          sender: user.id,
          title: "Trust Circle Request",
          message: `${user.name} sent you a trust request.`,
          type: "trust_request",
          createdAt: serverTimestamp(),
          timestamp: serverTimestamp(),
          read: false,
          deepLink: "/circle",
        });
      } catch (notifErr) {
        console.warn("[TrustNet Debug] Failed to write notification doc:", notifErr);
      }

      setInviteSuccess(true);
      setSearchResult((prev) => ({
        ...prev,
        relationshipStatus: "pending",
        relationshipId: docRef.id,
      }));
    } catch (err) {
      console.error("[TrustNet Debug] Invitation creation failed:", err);
      setInviteError("Failed to send invitation. Please try again.");
    } finally {
      setSendingInvite(false);
    }
  }

  // 4. Cancel outgoing pending invite
  async function handleCancelInvite(relationshipId) {
    if (!relationshipId) return;
    try {
      await deleteDoc(doc(db, "trust_relationships", relationshipId));
      setSearchResult((prev) => ({
        ...prev,
        relationshipStatus: "None",
        relationshipId: "",
      }));
    } catch (err) {
      console.error("[TrustNet Debug] Cancel invite failed:", err);
    }
  }

  // 5. Remove contact from Firestore
  async function removeContact(relationshipId) {
    if (!relationshipId) return;
    console.log(`[TrustNet Debug] Removing relationship ID: "${relationshipId}"`);
    try {
      await deleteDoc(doc(db, "trust_relationships", relationshipId));
    } catch (err) {
      console.error("[TrustNet Debug] Failed to delete contact:", err);
    }
  }

  // Generate external invite links
  const inviteText = encodeURIComponent(
    `Hey! Please join my trust safety circle on TrustNet to keep each other safe in real-time. Register here: ${window.location.origin}/signup`,
  );
  const whatsappUrl = `https://api.whatsapp.com/send?text=${inviteText}`;
  const smsUrl = `sms:?&body=${inviteText}`;

  return (
    <div className="min-h-screen bg-[#faf9fc] pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200 flex items-center gap-3 px-4 h-14">
        <Link
          to="/circle"
          className="material-symbols-outlined text-gray-700 hover:bg-gray-100 p-1.5 rounded-full transition"
        >
          arrow_back
        </Link>
        <h1 className="text-base font-semibold flex-1">Search &amp; Add Contacts</h1>
        <button
          onClick={() => router.navigate({ to: "/circle" })}
          className="text-xs font-semibold text-[#0d631b] hover:bg-[#0d631b]/5 px-3 py-1.5 rounded-full transition"
        >
          Done
        </button>
      </header>

      <div className="max-w-md md:max-w-2xl mx-auto p-4 flex flex-col gap-6">
        {/* Search Panel */}
        <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-2">Search TrustNet Network</h2>
          <p className="text-xs text-gray-500 mb-4">
            Enter an email address or phone number to search for registered guardians and contacts.
          </p>

          <form onSubmit={handleSearchSubmit} className="relative flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                required
                placeholder="e.g. email@example.com or 9717785040"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearched(false);
                }}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0d631b]/30 focus:border-[#0d631b] transition"
              />

              <span className="material-symbols-outlined absolute left-3.5 top-3 text-gray-400 text-lg">
                search
              </span>
            </div>
            <button
              type="submit"
              disabled={searching}
              className="bg-[#0d631b] text-white font-semibold px-4 py-2.5 rounded-xl hover:bg-[#0a5215] active:scale-[0.98] transition disabled:opacity-60 text-sm"
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </form>

          {/* Search Results */}
          {searched && (
            <div className="mt-5 border-t border-gray-150 pt-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Search Results
              </h3>

              {!searchResult ? (
                <div className="text-center py-5 px-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-xs text-gray-600 font-medium">
                    No registered user found with this email address or phone number.
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Send them an invitation link instead via:
                  </p>
                  <div className="flex gap-2 justify-center mt-3">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 bg-[#25D366] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg hover:opacity-90 transition shadow-sm"
                    >
                      <span className="material-symbols-outlined text-sm">share</span>
                      WhatsApp
                    </a>
                    <a
                      href={smsUrl}
                      className="flex items-center gap-1.5 bg-gray-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg hover:bg-gray-800 transition shadow-sm"
                    >
                      <span className="material-symbols-outlined text-sm">sms</span>
                      SMS Link
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3.5 bg-gray-55 border border-gray-150 rounded-xl transition">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      name={searchResult.name}
                      avatarUrl={searchResult.avatar}
                      sizeClassName="w-10 h-10 text-xs font-semibold"
                      className="border border-gray-200"
                    />

                    <div>
                      <p className="font-semibold text-xs text-gray-900">{searchResult.name}</p>
                      <p className="text-[10px] text-gray-500">{searchResult.phone}</p>
                    </div>
                  </div>

                  <div>
                    {searchResult.relationshipStatus === "accepted" ? (
                      <span className="text-[11px] font-bold text-[#0d631b] bg-[#0d631b]/10 px-3 py-1.5 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">check</span>
                        Added
                      </span>
                    ) : searchResult.relationshipStatus === "pending" ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full font-semibold border border-amber-100">
                          Invite Sent
                        </span>
                        <button
                          onClick={() => handleCancelInvite(searchResult.relationshipId)}
                          className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={customRelation}
                          onChange={(e) => setCustomRelation(e.target.value)}
                          className="border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-[#0d631b]"
                        >
                          {["Friend", "Family", "Partner", "Colleague", "Neighbor", "Other"].map(
                            (r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ),
                          )}
                        </select>
                        <button
                          onClick={handleSendInvite}
                          disabled={sendingInvite}
                          className="bg-[#0d631b] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg hover:bg-[#0a5215] transition shadow-sm cursor-pointer"
                        >
                          {sendingInvite ? "Sending…" : "Send Invite"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {inviteSuccess && (
                <p className="text-[11px] text-emerald-600 font-semibold mt-2 text-center">
                  Invitation sent successfully!
                </p>
              )}
              {inviteError && (
                <p className="text-[11px] text-red-600 font-medium mt-2 text-center">
                  {inviteError}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Existing Contacts Section */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">
            Your Trust Circle contacts ({contacts.length})
          </h2>

          {contacts.length === 0 ? (
            <p className="text-xs text-gray-400 bg-white border border-dashed border-gray-300 rounded-2xl p-6 text-center shadow-sm">
              No trusted contacts yet. Use the search bar above to invite members.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="bg-white border border-gray-200 rounded-2xl p-3.5 flex items-center justify-between shadow-sm hover:border-gray-300 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <UserAvatar
                        name={c.name}
                        avatarUrl={c.avatar}
                        sizeClassName="w-10 h-10 text-xs font-semibold"
                        className="border border-gray-150"
                      />

                      <span
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${
                          c.online ? "bg-green-500" : "bg-gray-400"
                        }`}
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-gray-900 flex items-center gap-1.5">
                        {c.name}
                        <span className="text-[10px] text-gray-400 font-normal">
                          ({c.relation})
                        </span>
                      </p>
                      <p className="text-[10px] text-gray-500">{c.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-[#0d631b]">
                      {c.status}
                    </span>
                    <button
                      onClick={() => removeContact(c.relationshipId)}
                      className="text-gray-400 hover:text-red-600 transition p-1 rounded-full hover:bg-gray-100 cursor-pointer"
                      aria-label="Remove Contact"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
