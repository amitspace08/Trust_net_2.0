import { Server } from "socket.io";
import User from "../models/User.js";
import TrustRelationship from "../models/TrustRelationship.js";

import SOSSession from "../models/SOSSession.js";

// Map to store connected users and their socket IDs
// In production with multiple servers, use Redis adapter instead
const userSockets = new Map();

// Map to store active heartbeat timeouts
const activeSOSHeartbeats = new Map();

export const initializeSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    // 1. Authenticate and map user to socket
    socket.on("register", (userId) => {
      userSockets.set(userId, socket.id);
      // Join a personal room for direct messages/notifications
      socket.join(`user_${userId}`);
      console.log(`User ${userId} registered to socket ${socket.id}`);
    });

    // 2. Real-time location updates from client
    socket.on("location:update", async (data) => {
      try {
        const { uid, lat, lng } = data;

        // Update DB
        const user = await User.findOne({ uid });
        if (user && user.locationSharingEnabled) {
          user.location = {
            type: "Point",
            coordinates: [lng, lat],
          };
          user.lastSeen = new Date();
          await user.save();

          // Broadcast to accepted contacts
          const relationships = await TrustRelationship.find({
            status: "accepted",
            $or: [{ requesterUid: uid }, { targetUid: uid }],
          });

          const contactUids = relationships.map((r) =>
            r.requesterUid === uid ? r.targetUid : r.requesterUid,
          );

          contactUids.forEach((contactUid) => {
            // Only emit to contacts who are currently online
            io.to(`user_${contactUid}`).emit("contact:locationUpdate", {
              uid,
              lat,
              lng,
              lastSeen: user.lastSeen,
            });
          });
        }
      } catch (error) {
        console.error("Socket location update error:", error);
      }
    });

    // SOS specific socket events
    socket.on("sos:join", (sessionId) => {
      socket.join(`sos_${sessionId}`);
      console.log(`Socket ${socket.id} joined SOS session ${sessionId}`);
    });

    socket.on("sos:locationPing", (data) => {
      // Re-broadcast to anyone tracking this SOS session
      io.to(`sos_${data.sessionId}`).emit("sos:locationUpdate", {
        uid: data.uid,
        lat: data.lat,
        lng: data.lng,
      });

      // Heartbeat management: if location pings, clear existing timeout
      if (activeSOSHeartbeats.has(data.sessionId)) {
        clearTimeout(activeSOSHeartbeats.get(data.sessionId));
      }

      // Set new 30s timeout
      const timeout = setTimeout(async () => {
        try {
          const session = await SOSSession.findById(data.sessionId);
          if (session && session.status === "active") {
            session.lastLocationStale = true;
            await session.save();
            io.to(`sos_${data.sessionId}`).emit("sos:distressedUserOffline", {
              sessionId: data.sessionId,
              message:
                "Distressed user lost connection. Last known location shown.",
            });
          }
          activeSOSHeartbeats.delete(data.sessionId);
        } catch (error) {
          console.error("Failed to mark location stale:", error);
        }
      }, 30000);

      activeSOSHeartbeats.set(data.sessionId, timeout);
    });

    // 3. Disconnect handling
    socket.on("disconnect", async () => {
      console.log("Client disconnected:", socket.id);

      // Find which user disconnected
      let disconnectedUid = null;
      for (const [uid, socketId] of userSockets.entries()) {
        if (socketId === socket.id) {
          disconnectedUid = uid;
          userSockets.delete(uid);
          break;
        }
      }

      if (disconnectedUid) {
        try {
          // Notify contacts that this user went offline
          const relationships = await TrustRelationship.find({
            status: "accepted",
            $or: [
              { requesterUid: disconnectedUid },
              { targetUid: disconnectedUid },
            ],
          });

          const contactUids = relationships.map((r) =>
            r.requesterUid === disconnectedUid ? r.targetUid : r.requesterUid,
          );

          contactUids.forEach((contactUid) => {
            io.to(`user_${contactUid}`).emit("contact:wentOffline", {
              uid: disconnectedUid,
            });
          });
        } catch (error) {
          console.error("Disconnect offline notification error:", error);
        }
      }
    });
  });
};
