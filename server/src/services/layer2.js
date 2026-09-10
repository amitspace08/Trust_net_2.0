import TrustRelationship from "../models/TrustRelationship.js";
import User from "../models/User.js";
import SOSSession from "../models/SOSSession.js";

// Utility for Haversine distance in meters
export const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Fuzzy location: adds a random 100-200m offset
export const fuzzLocation = (lat, lng) => {
  const R = 6371e3; // Earth's radius in meters
  // Random distance between 100 and 200 meters
  const d = 100 + Math.random() * 100;
  // Random bearing
  const brng = Math.random() * 2 * Math.PI;

  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(d / R) +
      Math.cos(φ1) * Math.sin(d / R) * Math.cos(brng),
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d / R) * Math.cos(φ1),
      Math.cos(d / R) - Math.sin(φ1) * Math.sin(φ2),
    );

  return { lat: (φ2 * 180) / Math.PI, lng: (λ2 * 180) / Math.PI };
};

/**
 * Traverses the trust graph to find friends-of-friends (Layer 2).
 * Returns an array of { uid, linkedViaName }
 */
export const getLayer2Candidates = async (userId) => {
  // 1. Get user's Layer 1 contacts
  const l1Relationships = await TrustRelationship.find({
    status: "accepted",
    $or: [{ requesterUid: userId }, { targetUid: userId }],
  });

  const l1Uids = l1Relationships.map((r) =>
    r.requesterUid === userId ? r.targetUid : r.requesterUid,
  );

  if (l1Uids.length === 0) return [];

  // Get names of L1 contacts for the "linkedViaName" field
  const l1Users = await User.find({ uid: { $in: l1Uids } }).select(
    "uid displayName",
  );
  const l1NameMap = new Map();
  l1Users.forEach((u) => l1NameMap.set(u.uid, u.displayName));

  // 2. Fetch relationships where one party is an L1 contact
  // This is effectively discovering L2 candidates.
  const l2Relationships = await TrustRelationship.find({
    status: "accepted",
    $or: [{ requesterUid: { $in: l1Uids } }, { targetUid: { $in: l1Uids } }],
  });

  const candidatesMap = new Map(); // uid -> linkedViaName

  l2Relationships.forEach((rel) => {
    // Determine which one is the L1, and which is the new L2
    const isRequesterL1 = l1Uids.includes(rel.requesterUid);
    const l1Uid = isRequesterL1 ? rel.requesterUid : rel.targetUid;
    const l2Uid = isRequesterL1 ? rel.targetUid : rel.requesterUid;

    // Filter out the distressed user themselves, and anyone already in L1
    if (l2Uid !== userId && !l1Uids.includes(l2Uid)) {
      // If reachable via multiple, we just keep the first one found
      // (v2 improvement: rank by strongest connection / multiple connections)
      if (!candidatesMap.has(l2Uid)) {
        candidatesMap.set(l2Uid, l1NameMap.get(l1Uid) || "Unknown");
      }
    }
  });

  return Array.from(candidatesMap.entries()).map(([uid, linkedViaName]) => ({
    uid,
    linkedViaName,
  }));
};

/**
 * Given candidates, fetches their location, filters out unavailable,
 * and sorts by distance from the distressed user.
 */
export const rankLayer2Candidates = async (candidates, distressedLocation) => {
  if (candidates.length === 0) return [];

  const candidateUids = candidates.map((c) => c.uid);

  // We use $geoNear in an aggregation pipeline to filter and sort efficiently
  // The 'location' field has a 2dsphere index on User.
  const rankedUsers = await User.aggregate([
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [distressedLocation.lng, distressedLocation.lat],
        },
        distanceField: "calculatedDistance",
        spherical: true,
        query: {
          uid: { $in: candidateUids },
          locationSharingEnabled: true,
          // only consider users seen in the last hour
          lastSeen: { $gt: new Date(Date.now() - 60 * 60 * 1000) },
        },
      },
    },
    { $limit: 10 }, // Top 10 closest
  ]);

  return rankedUsers.map((user) => {
    const candidateLink = candidates.find((c) => c.uid === user.uid);
    return {
      uid: user.uid,
      name: user.displayName,
      distance: user.calculatedDistance,
      linkedViaName: candidateLink?.linkedViaName,
    };
  });
};

/**
 * Helper: Find the mutual connection name between two users
 */
export const getMutualConnection = async (userId, candidateId) => {
  const l1Rels = await TrustRelationship.find({
    status: "accepted",
    $or: [{ requesterUid: userId }, { targetUid: userId }],
  });
  const l1Uids = l1Rels.map((r) =>
    r.requesterUid === userId ? r.targetUid : r.requesterUid,
  );

  const candidateRels = await TrustRelationship.find({
    status: "accepted",
    $or: [{ requesterUid: candidateId }, { targetUid: candidateId }],
  });
  const candidateL1Uids = candidateRels.map((r) =>
    r.requesterUid === candidateId ? r.targetUid : r.requesterUid,
  );

  // Find intersection
  const mutualUids = l1Uids.filter((uid) => candidateL1Uids.includes(uid));

  if (mutualUids.length > 0) {
    const mutualUser = await User.findOne({ uid: mutualUids[0] });
    return mutualUser?.displayName || "a mutual friend";
  }

  return "a mutual friend";
};

/**
 * Trigger Layer 2 Escalation
 */
export const triggerLayer2 = async (sessionId) => {
  const session = await SOSSession.findById(sessionId);
  if (!session) throw new Error("Session not found");

  const candidates = await getLayer2Candidates(session.uid);
  const ranked = await rankLayer2Candidates(
    candidates,
    session.locationSnapshot,
  );

  session.layerActive = 2;
  session.layer2Alerted = ranked.map((r) => r.uid);
  session.layer2TriggerTime = new Date();
  await session.save();

  return { session, ranked };
};
