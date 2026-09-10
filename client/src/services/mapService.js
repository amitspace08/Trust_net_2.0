import { db } from "../firebase/firebase";
import { collection, onSnapshot } from "firebase/firestore";

export const subscribeToLocations = (callback) => {
  return onSnapshot(collection(db, "user_locations"), (snapshot) => {
    const users = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    callback(users);
  });
};
