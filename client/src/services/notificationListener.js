import { db } from "../firebase/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export const subscribeToNotifications = (receiver, callback) => {
  const q = query(
    collection(db, "notifications"),
    where("receiver", "==", receiver),
    where("read", "==", false),
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    callback(notifications);
  });
};
