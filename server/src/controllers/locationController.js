
import User from "../models/User.js";
import TrustRelationship from "../models/TrustRelationship.js";

import { io } from "../server.js";

export const updateLocation = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const { lat, lng } = req.body;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ message: "lat and lng required" });
    }

    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.location = {
      type: "Point",
      coordinates: [lng, lat], // GeoJSON requires [longitude, latitude]
    };
    user.lastSeen = new Date();
    await user.save();

    // Broadcast if sharing is enabled
    if (user.locationSharingEnabled) {
      const relationships = await TrustRelationship.find({
        status: "accepted",
        $or: [{ requesterUid: uid }, { targetUid: uid }],
      });

      const contactUids = relationships.map((r) =>
        r.requesterUid === uid ? r.targetUid : r.requesterUid,
      );

      contactUids.forEach((contactUid) => {
        io.to(`user_${contactUid}`).emit("contact:locationUpdate", {
          uid,
          lat,
          lng,
          lastSeen: user.lastSeen,
        });
      });
    }

    res.json({ message: "Location updated", location: user.location });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const toggleSharing = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const { enabled } = req.body;

    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.locationSharingEnabled = !!enabled;
    await user.save();

    if (!enabled) {
      // Notify contacts that this user went offline/stopped sharing
      const relationships = await TrustRelationship.find({
        status: "accepted",
        $or: [{ requesterUid: uid }, { targetUid: uid }],
      });
      const contactUids = relationships.map((r) =>
        r.requesterUid === uid ? r.targetUid : r.requesterUid,
      );

      contactUids.forEach((contactUid) => {
        io.to(`user_${contactUid}`).emit("contact:wentOffline", { uid });
      });
    }

    res.json({
      message: "Sharing toggled",
      enabled: user.locationSharingEnabled,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getContactsLocations = async (req, res) => {
  try {
    const uid = req.user?.uid;

    const relationships = await TrustRelationship.find({
      status: "accepted",
      $or: [{ requesterUid: uid }, { targetUid: uid }],
    });

    const contactUids = relationships.map((r) =>
      r.requesterUid === uid ? r.targetUid : r.requesterUid,
    );

    // Only fetch users who have sharing enabled
    const contacts = await User.find({
      uid: { $in: contactUids },
      locationSharingEnabled: true,
      location: { $exists: true },
    }).select("uid displayName location lastSeen");

    const formatted = contacts.map((c) => {
      // Check for staleness (> 1 hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const isStale = !c.lastSeen || c.lastSeen < oneHourAgo;

      return {
        uid: c.uid,
        displayName: c.displayName,
        lat: c.location?.coordinates[1] || 0,
        lng: c.location?.coordinates[0] || 0,
        lastSeen: c.lastSeen,
        isStale,
      };
    });

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
