
import TrustRelationship from "../models/TrustRelationship.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";

import { io } from "../server.js";

export const sendInvite = async (req, res) => {
  const { targetUid } = req.body;
  const requesterUid = req.user?.uid;

  if (targetUid === requesterUid) {
    return res.status(400).json({ message: "You cannot invite yourself" });
  }

  try {
    const existing = await TrustRelationship.findOne({
      $or: [
        { requesterUid, targetUid },
        { requesterUid: targetUid, targetUid: requesterUid },
      ],
    });

    if (existing) {
      return res.status(400).json({ message: "Relationship already exists" });
    }

    const relationship = await TrustRelationship.create({
      requesterUid,
      targetUid,
      status: "pending",
    });

    // Create Notification
    const notification = await Notification.create({
      receiverUid: targetUid,
      senderUid: requesterUid,
      type: "trust_invite",
      message: "You have a new trust circle invitation",
    });

    io.to(`user_${targetUid}`).emit("new_notification", notification);

    res.status(201).json(relationship);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getContacts = async (req, res) => {
  const uid = req.user?.uid;

  try {
    const relationships = await TrustRelationship.find({
      status: "accepted",
      $or: [{ requesterUid: uid }, { targetUid: uid }],
    });

    const contactUids = relationships.map((r) =>
      r.requesterUid === uid ? r.targetUid : r.requesterUid,
    );
    const contacts = await User.find({ uid: { $in: contactUids } }).select(
      "-passwordHash",
    );

    res.json(contacts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const handleInvite = async (req, res) => {
  const { id } = req.params; // relationship id
  const { action } = req.body; // 'accept' or 'reject'
  const uid = req.user?.uid;

  try {
    const relationship = await TrustRelationship.findById(id);

    if (!relationship) return res.status(404).json({ message: "Not found" });
    if (relationship.targetUid !== uid)
      return res.status(403).json({ message: "Unauthorized" });

    if (action === "accept") {
      relationship.status = "accepted";
      await relationship.save();

      // Notify requester
      const notification = await Notification.create({
        receiverUid: relationship.requesterUid,
        senderUid: uid,
        type: "invite_accepted",
        message: "Your trust circle invitation was accepted",
      });
      io.to(`user_${relationship.requesterUid}`).emit(
        "new_notification",
        notification,
      );

      res.json(relationship);
    } else if (action === "reject") {
      await relationship.deleteOne();
      res.json({ message: "Invitation rejected" });
    } else {
      res.status(400).json({ message: "Invalid action" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
