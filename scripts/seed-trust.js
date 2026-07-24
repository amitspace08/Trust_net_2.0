import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp, GeoPoint } from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBc9ngpaHNcMJy7A8ajNIvbYtEPyt9YhfI",
  authDomain: "trustnet-c6a94.firebaseapp.com",
  projectId: "trustnet-c6a94",
  storageBucket: "trustnet-c6a94.firebasestorage.app",
  messagingSenderId: "947759878994",
  appId: "1:947759878994:web:899dac1eb729557243e08b",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const MOCK_USERS = [
  { name: "Aarav Mehta", email: "aarav@trustnet.com", phone: "+919876543210" },
  { name: "Diya Patel", email: "diya@trustnet.com", phone: "+919876543211" },
  { name: "Kabir Singh", email: "kabir@trustnet.com", phone: "+919876543212" },
  { name: "Isha Sharma", email: "isha@trustnet.com", phone: "+919876543213" },
  { name: "Reyansh Gupta", email: "reyansh@trustnet.com", phone: "+919876543214" }
];

async function seed() {
  console.log("Seeding 5 mock client accounts...");
  const uids = {};

  for (const user of MOCK_USERS) {
    let uid = "";
    try {
      // Try to create user
      const userCredential = await createUserWithEmailAndPassword(auth, user.email, "Password123!");
      uid = userCredential.user.uid;
      console.log(`Created new auth account for: ${user.name} (UID: ${uid})`);
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        // If already exists, sign in to get UID
        const userCredential = await signInWithEmailAndPassword(auth, user.email, "Password123!");
        uid = userCredential.user.uid;
        console.log(`Auth account already exists, signed in: ${user.name} (UID: ${uid})`);
      } else {
        throw err;
      }
    }
    
    uids[user.email] = uid;

    // Write user profile document (must be authenticated as this user to write users/{uid})
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, {
      uid: uid,
      displayName: user.name,
      name: user.name,
      email_id: user.email,
      phone_no: user.phone,
      phone: user.phone,
      profile_photo: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`,
      verification_status: true,
      online: true,
      createdAt: serverTimestamp(),
    }, { merge: true });

    // Seed initial location (must be authenticated as this user to write user_locations/{uid})
    const locRef = doc(db, "user_locations", uid);
    const lat = 28.6139 + (Math.random() - 0.5) * 0.01;
    const lng = 77.209 + (Math.random() - 0.5) * 0.01;
    await setDoc(locRef, {
      uid: uid,
      geopoint: new GeoPoint(lat, lng),
      latitude: lat,
      longitude: lng,
      sharingEnabled: true,
      timestamp: serverTimestamp(),
    }, { merge: true });

    // Sign out to clear context before next iteration
    await signOut(auth);
  }

  console.log("Establishing trust relationships...");

  const aaravEmail = "aarav@trustnet.com";
  const diyaEmail = "diya@trustnet.com";
  const kabirEmail = "kabir@trustnet.com";
  const ishaEmail = "isha@trustnet.com";
  const reyanshEmail = "reyansh@trustnet.com";

  // Sign in as Aarav to establish relationships from Aarav
  console.log("Signing in as Aarav to request relationships...");
  await signInWithEmailAndPassword(auth, aaravEmail, "Password123!");

  const aaravRels = [
    { id: `rel_${uids[aaravEmail]}_${uids[diyaEmail]}`, userA: uids[aaravEmail], userB: uids[diyaEmail], status: "accepted", relation: "Family" },
    { id: `rel_${uids[aaravEmail]}_${uids[kabirEmail]}`, userA: uids[aaravEmail], userB: uids[kabirEmail], status: "accepted", relation: "Friend" },
    { id: `rel_${uids[aaravEmail]}_${uids[ishaEmail]}`, userA: uids[aaravEmail], userB: uids[ishaEmail], status: "accepted", relation: "Friend" }
  ];

  for (const rel of aaravRels) {
    const relRef = doc(db, "trust_relationships", rel.id);
    await setDoc(relRef, {
      userA: rel.userA,
      userB: rel.userB,
      status: rel.status,
      relation: rel.relation,
      createdAt: serverTimestamp(),
    }, { merge: true });
  }
  await signOut(auth);

  // Sign in as Diya to establish relationships from Diya
  console.log("Signing in as Diya to request relationships...");
  await signInWithEmailAndPassword(auth, diyaEmail, "Password123!");

  const diyaRels = [
    { id: `rel_${uids[diyaEmail]}_${uids[kabirEmail]}`, userA: uids[diyaEmail], userB: uids[kabirEmail], status: "accepted", relation: "Friend" },
    { id: `rel_${uids[diyaEmail]}_${uids[reyanshEmail]}`, userA: uids[diyaEmail], userB: uids[reyanshEmail], status: "pending", relation: "Family" }
  ];

  for (const rel of diyaRels) {
    const relRef = doc(db, "trust_relationships", rel.id);
    await setDoc(relRef, {
      userA: rel.userA,
      userB: rel.userB,
      status: rel.status,
      relation: rel.relation,
      createdAt: serverTimestamp(),
    }, { merge: true });
  }
  await signOut(auth);

  console.log("Seeding complete successfully!");
}

seed().catch(console.error);
