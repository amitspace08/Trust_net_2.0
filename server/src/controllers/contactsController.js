
import TrustRelationship from "../models/TrustRelationship.js";
import User from "../models/User.js";

import { io } from "../server.js";
import mongoose from "mongoose";

export const searchContacts = async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone)
      return res
        .status(400)
        .json({ message: "Phone number query is required" });

    // Partial match search
    const users = await User.find({
      phone_no: { $regex: phone, $options: "i" },
    })
      .select("uid displayName photoURL phone_no")
      .limit(20);

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const sendRequest = async (req, res) => {
  try {
    const { targetUid } = req.body;
    const requesterUid = req.user?.uid;

    if (!requesterUid || !targetUid)
      return res.status(400).json({ message: "Missing uids" });
    if (targetUid === requesterUid)
      return res.status(400).json({ message: "You cannot invite yourself" });

    const existing = await TrustRelationship.findOne({
      $or: [
        { requesterUid, targetUid },
        { requesterUid: targetUid, targetUid: requesterUid },
      ],
    });

    if (existing) {
      return res
        .status(400)
        .json({ message: "Relationship already exists or is pending" });
    }

    const relationship = await TrustRelationship.create({
      requesterUid,
      targetUid,
      status: "pending",
    });

    // Populate requester details to send to the target via socket
    const requesterUser = await User.findOne({ uid: requesterUid }).select(
      "uid displayName photoURL",
    );

    io.to(`user_${targetUid}`).emit("trustRequest:received", {
      relationshipId: relationship._id,
      requester: requesterUser,
    });

    res.status(201).json(relationship);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const acceptRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const uid = req.user?.uid;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid relationship ID" });
    }

    const relationship = await TrustRelationship.findById(id);

    if (!relationship)
      return res.status(404).json({ message: "Request not found" });
    if (relationship.targetUid !== uid)
      return res.status(403).json({ message: "Unauthorized" });

    relationship.status = "accepted";
    await relationship.save();

    const targetUser = await User.findOne({ uid }).select(
      "uid displayName photoURL",
    );

    io.to(`user_${relationship.requesterUid}`).emit("trustRequest:accepted", {
      relationshipId: relationship._id,
      target: targetUser,
    });

    res.json(relationship);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const uid = req.user?.uid;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid relationship ID" });
    }

    const relationship = await TrustRelationship.findById(id);

    if (!relationship)
      return res.status(404).json({ message: "Request not found" });
    if (relationship.targetUid !== uid)
      return res.status(403).json({ message: "Unauthorized" });

    relationship.status = "rejected";
    await relationship.save();

    res.json({ message: "Request rejected" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyCircle = async (req, res) => {
  try {
    const uid = req.user?.uid;

    const relationships = await TrustRelationship.find({
      status: "accepted",
      $or: [{ requesterUid: uid }, { targetUid: uid }],
    });

    const contactUids = relationships.map((r) =>
      r.requesterUid === uid ? r.targetUid : r.requesterUid,
    );
    const contacts = await User.find({ uid: { $in: contactUids } }).select(
      "uid displayName photoURL phone_no status lastSeen locationEnabled locationSharingEnabled",
    );

    res.json(contacts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getIncomingRequests = async (req, res) => {
  try {
    const uid = req.user?.uid;

    const relationships = await TrustRelationship.find({
      targetUid: uid,
      status: "pending",
    });

    const requesterUids = relationships.map((r) => r.requesterUid);
    const requesters = await User.find({ uid: { $in: requesterUids } }).select(
      "uid displayName photoURL",
    );

    const formattedRequests = relationships.map((rel) => {
      const requester = requesters.find((u) => u.uid === rel.requesterUid);
      return {
        _id: rel._id,
        requesterUid: rel.requesterUid,
        createdAt: rel.createdAt,
        requester: requester || { displayName: "Unknown User" },
      };
    });

    res.json(formattedRequests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
