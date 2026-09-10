

import User from "../models/User.js";
import SOSSession from "../models/SOSSession.js";
import ActiveLayerAlert from "../models/ActiveLayerAlert.js";
import { io } from "../server.js";
import { triggerLayer3 } from "../services/layer3.js"; // Will create this next

export const registerGuardian = async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { uid: req.user.uid },
      {
        isGuardianAngel: true,
        guardianVerified: true, // Auto-approve for demo
        guardianAvailable: true,
        guardianRegisteredAt: new Date(),
      },
      { new: true },
    );
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const toggleAvailability = async (req, res) => {
  try {
    const { available } = req.body;
    const user = await User.findOneAndUpdate(
      { uid: req.user.uid },
      { guardianAvailable: available },
      { new: true },
    );
    res.json({ available: user?.guardianAvailable });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const acknowledgeLayer3 = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const responderUID = req.user.uid;

    const session = await SOSSession.findById(sessionId);
    if (!session || session.status !== "active") {
      return res.status(400).json({ message: "SOS session is not active" });
    }

    const responder = await User.findOne({ uid: responderUID });
    if (!responder) return res.status(404).json({ message: "User not found" });

    // Ensure they are actually alerted
    const alert = await ActiveLayerAlert.findOne({
      sessionId: session._id,
      candidateUID: responderUID,
      layer: 3,
    });
    if (!alert) {
      return res
        .status(400)
        .json({ message: "You have no active Layer 3 alert for this session" });
    }

    // Add responder to session
    await SOSSession.findByIdAndUpdate(session._id, {
      $push: {
        responders: {
          uid: responderUID,
          name: responder.displayName,
          respondedAt: new Date(),
          currentLocation:
            responder.location && responder.location.coordinates.length > 0
              ? {
                  lng: responder.location.coordinates[0],
                  lat: responder.location.coordinates[1],
                }
              : undefined,
        },
      },
    });

    // Clear all L3 alerts for this session to stop notifying others
    await ActiveLayerAlert.deleteMany({ sessionId: session._id, layer: 3 });

    io.to(session.uid).emit("sos:layer3ResponderJoined", {
      uid: responderUID,
      name: responder.displayName,
      location:
        responder.location && responder.location.coordinates.length > 0
          ? {
              lng: responder.location.coordinates[0],
              lat: responder.location.coordinates[1],
            }
          : undefined,
    });

    res.json({ message: "Acknowledged successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const declineLayer3 = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const responderUID = req.user.uid;

    const session = await SOSSession.findById(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found" });

    // Mark as declined so they won't be retried
    await SOSSession.findByIdAndUpdate(session._id, {
      $addToSet: { declinedCandidates: responderUID },
    });

    // Remove their active alert
    await ActiveLayerAlert.deleteOne({
      sessionId: session._id,
      candidateUID: responderUID,
      layer: 3,
    });

    io.to(session.uid).emit("sos:layer3NextCandidate", {
      uid: responderUID,
      status: "declined",
    });

    res.json({ message: "Declined" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const submitGuardianRating = async (req, res) => {
  try {
    const { guardianUID, rating } = req.body;

    // Increment response count and update running average rating
    const guardian = await User.findOne({ uid: guardianUID });
    if (!guardian)
      return res.status(404).json({ message: "Guardian not found" });

    const currentCount = guardian.guardianResponseCount || 0;
    const currentRating = guardian.guardianRating || 0;

    const newCount = currentCount + 1;
    const newRating = (currentRating * currentCount + rating) / newCount;

    await User.findOneAndUpdate(
      { uid: guardianUID },
      {
        guardianResponseCount: newCount,
        guardianRating: parseFloat(newRating.toFixed(2)),
      },
    );

    res.json({ message: "Rating submitted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
