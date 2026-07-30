import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

export const sendPushNotification = functions.firestore
  .document("notifications/{notificationId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    if (!data.receiverUID) return;

    // Get receiver's FCM token from user doc
    const userSnap = await db.collection("users").doc(data.receiverUID).get();
    if (!userSnap.exists) return;
    
    const fcmToken = userSnap.data()?.fcmToken;
    if (!fcmToken) {
      console.log(`No FCM token for user ${data.receiverUID}`);
      return;
    }

    const payload = {
      token: fcmToken,
      notification: {
        title: data.title,
        body: data.message,
      },
      data: {
        click_action: data.deepLink || "/",
      },
      android: {
        collapseKey: data.sessionId || data.type || "default",
        notification: {
          tag: data.sessionId || data.type || "default",
        },
      },
      webpush: {
        headers: {
          Topic: data.sessionId || data.type || "default",
        },
        notification: {
          tag: data.sessionId || data.type || "default",
        },
      },
      apns: {
        headers: {
          "apns-collapse-id": data.sessionId || data.type || "default",
        },
      },
    };

    try {
      await admin.messaging().send(payload);
      console.log(`Successfully sent message to ${data.receiverUID}`);
      // Mark notification as sent
      await snap.ref.update({ pushSent: true });
    } catch (error) {
      console.error("Error sending push notification:", error);
    }
  });
