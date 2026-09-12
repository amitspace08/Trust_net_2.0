
import SOSSession from "../models/SOSSession.js";
import UserLocation from "../models/UserLocation.js";
import TrustRelationship from "../models/TrustRelationship.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import ActiveLayerAlert from "../models/ActiveLayerAlert.js";
import { triggerLayer2, fuzzLocation } from "../services/layer2.js";
import { triggerLayer3 } from "../services/layer3.js";
import { io } from "../server.js";

// Track active timers to clear them if SOS is ended or cancelled
export const activeSOSTimers = new Map();

const clearSessionAlerts = async (sessionId) => {
  try {
    await ActiveLayerAlert.deleteMany({ sessionId });
  } catch (err) {
    console.error("Failed to clear active layer 2 alerts", err);
  }
};

export const triggerSOS = async (req, res) => {
  const uid = req.user?.uid;
  const { lat, lng } = req.body;

  try {
    // Idempotency check: if user already has an active session, return it
    const existingSession = await SOSSession.findOne({ uid, status: "active" });
    if (existingSession) {
      return res.status(200).json(existingSession);
    }

    // Get layer 1 contacts
    const relationships = await TrustRelationship.find({
      status: "accepted",
      $or: [{ requesterUid: uid }, { targetUid: uid }],
    });

    const contactUids = relationships.map((r) =>
      r.requesterUid === uid ? r.targetUid : r.requesterUid,
    );

    // Create new SOS session
    const session = await SOSSession.create({
      uid,
      status: "active",
      layerActive: 1,
      startTime: new Date(),
      layer1Alerted: contactUids,
      layer1Acknowledged: false,
      locationSnapshot: { lat, lng },
      responders: [],
    });

    const user = await User.findOne({ uid });

    // Notify all trusted contacts via socket
    contactUids.forEach(async (contactUid) => {
      io.to(`user_${contactUid}`).emit("sos:incoming", {
        sessionId: session._id,
        distressedUserUid: uid,
        distressedUserName: user?.name || "A trusted contact",
        location: { lat, lng },
      });
      // Store pending alert in DB for offline users
      await Notification.create({
        receiverUid: contactUid,
        senderUid: uid,
        type: "sos_alert",
        message: "EMERGENCY! A trusted contact has activated SOS.",
        metadata: { sessionId: session._id, lat, lng },
      });
    });

    // Start server-side timers
    // Environment-based timeouts
    const FAST = process.env.SOS_TIMEOUTS_FAST === "true";
    const L1_PING = FAST ? 2500 : 45000;
    const L1_TIMEOUT = FAST ? 5000 : 90000;
    const L2_TIMEOUT = FAST ? 10000 : 120000;

    const timer45s = setTimeout(async () => {
      const currentSession = await SOSSession.findById(session._id);
      if (
        currentSession &&
        currentSession.status === "active" &&
        !currentSession.layer1Acknowledged
      ) {
        contactUids.forEach((contactUid) => {
          io.to(`user_${contactUid}`).emit("sos:followUp", {
            sessionId: session._id,
          });
        });
      }
    }, L1_PING);

    const timer90s = setTimeout(async () => {
      const currentSession = await SOSSession.findById(session._id);
      if (
        currentSession &&
        currentSession.status === "active" &&
        !currentSession.layer1Acknowledged
      ) {
        console.log(
          `Layer 1 timeout for SOS ${session._id} — Escalating to Layer 2`,
        );

        try {
          const { session: l2Session, ranked } = await triggerLayer2(
            session._id.toString(),
          );

          if (ranked.length > 0) {
            const firstCandidate = ranked[0];
            const fuzzed = fuzzLocation(lat, lng);

            // Notify the first candidate
            await ActiveLayerAlert.create({
              sessionId: l2Session._id,
              candidateUID: firstCandidate.uid,
            });

            io.to(`user_${firstCandidate.uid}`).emit("sos:layer2Alert", {
              sessionId: l2Session._id,
              distressedUserUid: uid,
              linkedViaName: firstCandidate.linkedViaName,
              distance: firstCandidate.distance,
              fuzzedLocation: fuzzed,
            });

            // Notify distressed user about status
            io.to(`user_${uid}`).emit("sos:layer2CounterUpdate", {
              contacted: 1,
              declined: 0,
              responding: 0,
              totalCandidates: ranked.length,
            });
          }

          // Start 120s L3 timer (which triggers at 210s total)
          const timer210s = setTimeout(async () => {
            console.log(
              `Layer 2 timeout for SOS ${session._id} — ready for Layer 3 escalation`,
            );
            await triggerLayer3(session._id.toString());
          }, L2_TIMEOUT);

          const timers = activeSOSTimers.get(session._id.toString());
          if (timers) {
            timers.timer210s = timer210s;
          }
        } catch (err) {
          console.error("Failed to escalate to layer 2", err);
        }
      }
    }, L1_TIMEOUT);

    activeSOSTimers.set(session._id.toString(), { timer45s, timer90s });

    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const cancelSOS = async (req, res) => {
  const uid = req.user?.uid;
  const { sessionId } = req.params;

  try {
    const session = await SOSSession.findOneAndUpdate(
      { _id: sessionId, uid, status: "active" },
      { status: "cancelled", endTime: new Date() },
      { new: true },
    );
    if (!session)
      return res
        .status(404)
        .json({ message: "Session not found or already cancelled" });

    const timers = activeSOSTimers.get(sessionId);
    if (timers) {
      clearTimeout(timers.timer45s);
      clearTimeout(timers.timer90s);
      if (timers.timer210s) clearTimeout(timers.timer210s);
      activeSOSTimers.delete(sessionId);
    }

    await clearSessionAlerts(sessionId);

    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const acknowledgeSOS = async (req, res) => {
  const uid = req.user?.uid;
  const { sessionId } = req.params;

  try {
    const responder = await User.findOne({ uid });

    // Use atomic update with guard condition
    const session = await SOSSession.findOneAndUpdate(
      { _id: sessionId, status: "active", "responders.uid": { $ne: uid } },
      {
        $push: {
          responders: {
            uid: responder?.uid || uid || "",
            name: responder?.name || "Responder",
            respondedAt: new Date(),
          },
        },
        $set: { layer1Acknowledged: true },
      },
      { new: true },
    );

    if (!session) {
      // Could be inactive, or already acknowledged by this user
      const existing = await SOSSession.findById(sessionId);
      if (!existing)
        return res.status(404).json({ message: "Session not found" });
      if (existing.status !== "active")
        return res.status(400).json({ message: "Session is no longer active" });
      return res.status(200).json(existing); // already responded
    }

    // Clear 90s timer if it hasn't fired yet
    const timers = activeSOSTimers.get(sessionId);
    if (timers) {
      clearTimeout(timers.timer90s);
    }

    // Emit to distressed user
    io.to(`user_${session.uid}`).emit("sos:responderJoined", {
      name: responder?.name || "Responder",
      uid: responder?.uid || uid,
    });

    // Also broadcast to the active SOS room for all current viewers/responders
    io.to(`sos_${session._id}`).emit("sos:responderJoined", {
      name: responder?.name || "Responder",
      uid: responder?.uid || uid,
    });

    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const endSOS = async (req, res) => {
  const uid = req.user?.uid;
  const { sessionId } = req.params;

  try {
    const session = await SOSSession.findOneAndUpdate(
      { _id: sessionId, uid, status: "active" },
      { status: "resolved", endTime: new Date() },
      { new: true },
    );
    if (!session)
      return res
        .status(404)
        .json({ message: "Session not found or already resolved" });

    // Clear timers
    const timers = activeSOSTimers.get(sessionId);
    if (timers) {
      clearTimeout(timers.timer45s);
      clearTimeout(timers.timer90s);
      if (timers.timer210s) clearTimeout(timers.timer210s);
      activeSOSTimers.delete(sessionId);
    }

    await clearSessionAlerts(sessionId);

    const user = await User.findOne({ uid });

    // Broadcast ended to all layer1 contacts and responders
    const endMessage = {
      sessionId: session._id,
      message: `${user?.name || "User"} has marked themselves safe`,
    };

    session.layer1Alerted.forEach((contactUid) => {
      io.to(`user_${contactUid}`).emit("sos:ended", endMessage);
    });

    // Also broadcast to the active SOS room for all current viewers/responders
    io.to(`sos_${session._id}`).emit("sos:ended", endMessage);

    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getSOS = async (req, res) => {
  const { sessionId } = req.params;
  const uid = req.user?.uid;
  try {
    const session = await SOSSession.findById(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found" });

    // Authorization check
    const isOwner = session.uid === uid;
    const isL1 = session.layer1Alerted.includes(uid || "");
    const isResponder = session.responders.some((r) => r.uid === uid);

    if (!isOwner && !isL1 && !isResponder) {
      return res
        .status(403)
        .json({
          message:
            "Forbidden. You do not have permanent access to this session.",
        });
    }

    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const acknowledgeLayer2 = async (req, res) => {
  const uid = req.user?.uid;
  const { sessionId } = req.params;

  try {
    const responder = await User.findOne({ uid });

    // Use atomic update
    const session = await SOSSession.findOneAndUpdate(
      { _id: sessionId, status: "active", "responders.uid": { $ne: uid } },
      {
        $push: {
          responders: {
            uid: responder?.uid || uid || "",
            name: responder?.name || "Responder",
            respondedAt: new Date(),
          },
        },
        $set: { layer1Acknowledged: "layer2" }, // Functionally acknowledging the layer
      },
      { new: true },
    );

    if (!session) {
      const existing = await SOSSession.findById(sessionId);
      if (!existing)
        return res.status(404).json({ message: "Session not found" });
      if (existing.status !== "active")
        return res.status(400).json({ message: "Session is no longer active" });
      return res.status(200).json(existing);
    }

    await ActiveLayerAlert.deleteOne({ sessionId, candidateUID: uid });

    // Clear timers
    const timers = activeSOSTimers.get(sessionId);
    if (timers) {
      clearTimeout(timers.timer90s);
      if (timers.timer210s) clearTimeout(timers.timer210s);
    }

    // Emit to distressed user
    io.to(`user_${session.uid}`).emit("sos:layer2ResponderJoined", {
      name: responder?.name || "Responder",
      uid: responder?.uid || uid,
      realLocation: responder?.location, // would send real location to them via socket room
    });

    // Broadcast to the active SOS room
    io.to(`sos_${session._id}`).emit("sos:responderJoined", {
      name: responder?.name || "Responder",
      uid: responder?.uid || uid,
    });

    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const declineLayer2 = async (req, res) => {
  const uid = req.user?.uid;
  const { sessionId } = req.params;

  try {
    // Atomic update to add to declinedCandidates and fetch the updated document
    const session = await SOSSession.findOneAndUpdate(
      { _id: sessionId, status: "active" },
      { $addToSet: { declinedCandidates: uid || "" } },
      { new: true },
    );

    if (!session)
      return res
        .status(404)
        .json({ message: "Session not found or no longer active" });

    // Delete the active alert for this candidate
    await ActiveLayerAlert.deleteOne({ sessionId, candidateUID: uid });

    // Find next candidate
    const pendingCandidates = (session.layer2Alerted || []).filter(
      (cUid) => !(session.declinedCandidates || []).includes(cUid),
    );

    if (pendingCandidates.length > 0) {
      const nextCandidateUid = pendingCandidates[0];
      // We will send a basic alert
      const fuzzed = fuzzLocation(
        session.locationSnapshot.lat,
        session.locationSnapshot.lng,
      );

      // We just emit the alert.
      await ActiveLayerAlert.create({
        sessionId: session._id,
        candidateUID: nextCandidateUid,
      });

      io.to(`user_${nextCandidateUid}`).emit("sos:layer2Alert", {
        sessionId: session._id,
        distressedUserUid: session.uid,
        linkedViaName: "a mutual friend", // Fallback, would be looked up in a full impl
        fuzzedLocation: fuzzed,
      });
      io.to(`user_${nextCandidateUid}`).emit("sos:layer2NextCandidate", {
        sessionId: session._id,
      }); // optional ping
    }

    // Update distressed user
    io.to(`user_${session.uid}`).emit("sos:layer2CounterUpdate", {
      contacted:
        (session.layer2Alerted || []).length - pendingCandidates.length + 1,
      declined: session.declinedCandidates?.length || 0,
      responding: 0,
      totalCandidates: (session.layer2Alerted || []).length,
    });

    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const archiveSOS = async (req, res, next) => {
  try {
    const data = req.body;
    if (!data || !data.firebaseId) {
       return res.status(400).json({ success: false, message: "Invalid payload" });
    }
    const SosArchive = (await import("../models/SosArchive.js")).default;
    const doc = await SosArchive.create(data);
    res.status(201).json({ success: true, archiveId: doc._id });
  } catch (err) {
    console.error("Archive error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
