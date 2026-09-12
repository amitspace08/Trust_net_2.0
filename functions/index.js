const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onTaskDispatched } = require("firebase-functions/v2/tasks");
const { getFunctions } = require("firebase-admin/functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * Triggered when a new SOS session is created.
 * Schedules the Layer 2 escalation task to run in 90 seconds.
 */
exports.onSosSessionCreated = onDocumentCreated("sos_sessions/{sessionId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const data = snapshot.data();
  const sessionId = event.params.sessionId;

  // Enqueue a task to escalate to Layer 2 after 90 seconds
  const queue = getFunctions().taskQueue("escalatesos");
  
  await queue.enqueue(
    { sessionId: sessionId, targetLayer: 2 },
    { scheduleDelaySeconds: 90 }
  );

  console.log(`[SOS ${sessionId}] Scheduled Layer 2 escalation in 90s`);
});

/**
 * Task Queue Function that handles escalating the SOS to the next layer.
 */
exports.escalatesos = onTaskDispatched(async (req) => {
  const { sessionId, targetLayer } = req.data;
  
  const sessionRef = db.collection("sos_sessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();
  
  if (!sessionSnap.exists) {
    console.log(`[SOS ${sessionId}] Session no longer exists. Aborting escalation.`);
    return;
  }
  
  const session = sessionSnap.data();

  // If the session is no longer active, or someone already responded, abort escalation.
  if (session.status !== "active" || session.responderUID) {
    console.log(`[SOS ${sessionId}] Session resolved or responder found. Aborting escalation to Layer ${targetLayer}.`);
    return;
  }

  // Ensure we haven't already escalated past this layer
  if (session.layerActive >= targetLayer) {
    console.log(`[SOS ${sessionId}] Session already at or past Layer ${targetLayer}. Aborting.`);
    return;
  }

  console.log(`[SOS ${sessionId}] Escalating to Layer ${targetLayer}`);

  if (targetLayer === 2) {
    // Escalate to Layer 2
    await sessionRef.update({
      layerActive: 2,
      layer2TriggerTime: admin.firestore.FieldValue.serverTimestamp()
    });

    // Schedule Layer 3 escalation (120 seconds after Layer 2)
    const queue = getFunctions().taskQueue("escalatesos");
    await queue.enqueue(
      { sessionId: sessionId, targetLayer: 3 },
      { scheduleDelaySeconds: 120 }
    );
    console.log(`[SOS ${sessionId}] Scheduled Layer 3 escalation in 120s`);

  } else if (targetLayer === 3) {
    // Escalate to Layer 3
    await sessionRef.update({
      layerActive: 3,
      layer3TriggerTime: admin.firestore.FieldValue.serverTimestamp()
    });

    // Schedule Layer 4 (Police) escalation (30 seconds later)
    const queue = getFunctions().taskQueue("escalatesos");
    await queue.enqueue(
      { sessionId: sessionId, targetLayer: 4 },
      { scheduleDelaySeconds: 30 }
    );
    console.log(`[SOS ${sessionId}] Scheduled Layer 4 escalation in 30s`);
    
  } else if (targetLayer === 4) {
    // Escalate to Layer 4 (Police/Exhausted)
    await sessionRef.update({
      layerActive: 4,
      layer3Exhausted: true
    });
    console.log(`[SOS ${sessionId}] Escalated to Layer 4 (Police)`);
  }
});


/**
 * Triggered when an SOS session is updated.
 * If it is cancelled or resolved, archive it to MongoDB and delete it from Firestore.
 */
exports.onSosSessionUpdated = require("firebase-functions/v2/firestore").onDocumentUpdated("sos_sessions/{sessionId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const before = snapshot.before.data();
  const after = snapshot.after.data();
  const sessionId = event.params.sessionId;

  // Only proceed if status CHANGED to resolved or cancelled
  if ((after.status === "resolved" || after.status === "cancelled") && before.status !== after.status) {
    console.log(`[SOS ${sessionId}] marked as ${after.status}. Archiving to MongoDB...`);
    
    try {
      const payload = {
        firebaseId: sessionId,
        triggeredBy: after.triggeredBy,
        latitude: after.latitude || 0,
        longitude: after.longitude || 0,
        status: after.status,
        responderUID: after.responderUID || null,
        finalLayer: after.layerActive || 1,
        firebaseCreatedAt: after.createdAt ? after.createdAt.toDate() : null,
        rawFirebaseData: after
      };

      // In production, configure SERVER_API_URL in Firebase environment config
      const apiUrl = process.env.SERVER_API_URL || "http://localhost:5000/api/sos/archive";
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        console.log(`[SOS ${sessionId}] Successfully archived to MongoDB.`);
        // Clean up from Firestore to save space
        await db.collection("sos_sessions").doc(sessionId).delete();
        console.log(`[SOS ${sessionId}] Deleted from Firestore.`);
      } else {
        console.error(`[SOS ${sessionId}] Failed to archive to MongoDB. Status: ${response.status}`);
      }
    } catch (err) {
      console.error(`[SOS ${sessionId}] Error connecting to MongoDB Express API:`, err);
    }
  }
});

