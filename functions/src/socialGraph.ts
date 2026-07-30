import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

// Layer 2 Candidates logic moved to Cloud Function
export const getLayer2Candidates = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  const uid = context.auth.uid;
  try {
    const layer1Snap = await db.collection("trust_relationships")
      .where("status", "==", "accepted")
      .get();
      
    const layer1 = layer1Snap.docs
      .map(doc => doc.data())
      .filter(item => item.userA === uid || item.userB === uid);

    const layer1UIDs = layer1.map(contact =>
      contact.userA === uid ? contact.userB : contact.userA
    );

    const candidateMap = new Map<string, any>();

    for (const layer1UID of layer1UIDs) {
      const contactsSnap = await db.collection("trust_relationships")
        .where("status", "==", "accepted")
        .get();
        
      const contacts = contactsSnap.docs
        .map(doc => doc.data())
        .filter(item => item.userA === layer1UID || item.userB === layer1UID);

      for (const contact of contacts) {
        const candidateUID = contact.userA === layer1UID ? contact.userB : contact.userA;
        if (candidateUID !== uid && !layer1UIDs.includes(candidateUID)) {
          if (!candidateMap.has(candidateUID)) {
            candidateMap.set(candidateUID, {
              uid: candidateUID,
              mutualConnectionUID: layer1UID,
            });
          }
        }
      }
    }

    const list = Array.from(candidateMap.values());
    const result = [];
    
    for (const item of list) {
      const userSnap = await db.collection("users").doc(item.mutualConnectionUID).get();
      const mutualName = userSnap.exists
        ? (userSnap.data()?.name || userSnap.data()?.displayName)
        : "Someone";
        
      result.push({
        ...item,
        mutualConnectionName: mutualName,
      });
    }
    
    return { candidates: result };
  } catch (error) {
    console.error(error);
    throw new functions.https.HttpsError("internal", "Failed to fetch Layer 2 candidates");
  }
});
