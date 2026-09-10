import User from "../models/User.js";
import SOSSession from "../models/SOSSession.js";
import ActiveLayerAlert from "../models/ActiveLayerAlert.js";
import { fuzzLocation } from "./layer2.js"; // reuse fuzzy logic
import { io } from "../server.js";

export const triggerLayer3 = async (sessionId) => {
  console.log(`Triggering Layer 3 for session ${sessionId}`);
  try {
    const session = await SOSSession.findById(sessionId);
    if (!session || session.status !== "active") return;

    const { lat, lng } = session.locationSnapshot;

    // Search for Guardian Angels
    // 500m -> 750m -> 1000m -> 2000m
    let guardians = [];
    let searchRadius = 500; // in meters
    const maxRadius = 2000;

    while (searchRadius <= maxRadius && guardians.length === 0) {
      guardians = await User.find({
        isGuardianAngel: true,
        guardianVerified: true,
        guardianAvailable: true,
        uid: { $ne: session.uid }, // not the distressed user
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [lng, lat],
            },
            $maxDistance: searchRadius,
          },
        },
      });
      if (guardians.length === 0) {
        searchRadius +=
          searchRadius === 500 ? 250 : searchRadius === 750 ? 250 : 1000;
      }
    }

    if (guardians.length === 0) {
      console.log(
        `No Guardian Angels found within 2km for session ${sessionId}`,
      );

      // Exhausted layer 3 immediately
      session.layer3Exhausted = true;
      session.layerActive = 3;
      session.layer3TriggerTime = new Date();
      await session.save();

      io.to(session.uid).emit("sos:layer3Exhausted", {
        message: "No nearby guardians found.",
      });
      return;
    }

    const rankedUIDs = guardians.map((g) => g.uid);

    session.layerActive = 3;
    session.layer3Alerted = rankedUIDs;
    session.layer3TriggerTime = new Date();
    await session.save();

    console.log(
      `Layer 3 found ${rankedUIDs.length} guardians for session ${sessionId}`,
    );

    const distressedUser = await User.findOne({ uid: session.uid });
    if (!distressedUser) return;

    // Initial alert to all Guardians in parallel? Or sequential?
    // "Sequential notification for Layer 3, same drain pattern as Layer 2"
    // Send to first candidate
    const firstCandidateUID = rankedUIDs[0];
    const candidate = guardians.find((g) => g.uid === firstCandidateUID);

    if (candidate && candidate.location && candidate.location.coordinates) {
      const cLng = candidate.location.coordinates[0];
      const cLat = candidate.location.coordinates[1];

      // Simple distance calc for display
      const R = 6371e3; // metres
      const φ1 = (lat * Math.PI) / 180;
      const φ2 = (cLat * Math.PI) / 180;
      const Δφ = ((cLat - lat) * Math.PI) / 180;
      const Δλ = ((cLng - lng) * Math.PI) / 180;
      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = Math.round(R * c);

      await ActiveLayerAlert.create({
        sessionId: session._id,
        candidateUID: firstCandidateUID,
        layer: 3,
      });

      io.to(firstCandidateUID).emit("sos:layer3Alert", {
        sessionId: session._id,
        distressedName: "Someone nearby", // No PII
        fuzzedLocation: fuzzLocation(lat, lng),
        distance,
      });
    }
  } catch (error) {
    console.error("Error triggering Layer 3:", error);
  }
};
