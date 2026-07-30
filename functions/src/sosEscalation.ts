import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

// Trigger on SOS Session creation
export const onSOSTriggered = functions.firestore
  .document("sos_sessions/{sessionId}")
  .onCreate(async (snap, context) => {
    const sessionId = context.params.sessionId;
    const sessionData = snap.data();
    
    console.log(`SOS Session ${sessionId} started by ${sessionData.distressedUID}. Starting 45s countdown for Layer 2 escalation.`);

    // Wait 45 seconds (Firebase Functions v1 allow up to 9 mins execution)
    await new Promise((resolve) => setTimeout(resolve, 45000));

    // Verify if session is still active
    const currentSession = await db.collection("sos_sessions").doc(sessionId).get();
    if (!currentSession.exists) return;
    
    const currentData = currentSession.data();
    if (currentData?.active === false || currentData?.responderUID) {
      console.log(`Session ${sessionId} was resolved. Aborting escalation.`);
      return;
    }
    
    if (currentData?.layerActive === 1) {
      console.log(`Escalating Session ${sessionId} to Layer 2`);
      await db.collection("sos_sessions").doc(sessionId).update({
        layerActive: 2,
        layer2AlertedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      // Send push notification to Layer 2 here...
    }
    
    // Wait another 45 seconds for Layer 3 escalation
    await new Promise((resolve) => setTimeout(resolve, 45000));

    const sessionL2 = await db.collection("sos_sessions").doc(sessionId).get();
    const currentDataL2 = sessionL2.data();
    
    if (currentDataL2?.active === false || currentDataL2?.responderUID) {
      console.log(`Session ${sessionId} was resolved in L2. Aborting escalation.`);
      return;
    }
    
    if (currentDataL2?.layerActive === 2) {
      console.log(`Escalating Session ${sessionId} to Layer 3 (Guardian Angels)`);
      await db.collection("sos_sessions").doc(sessionId).update({
        layerActive: 3,
        layer3AlertedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });
