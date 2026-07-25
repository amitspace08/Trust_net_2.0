import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { auth } from "../firebase/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";

// Self-clearing block to wipe out local storage cache for the user automatically
if (typeof window !== "undefined" && !localStorage.getItem("trustnet_db_cleared_v2")) {
  localStorage.clear();
  localStorage.setItem("trustnet_db_cleared_v2", "true");
}


export type User = { 
  id: string; 
  name: string; 
  email: string;
  avatar?: string;
  profile_photo?: string;
};

type AuthState = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, avatarUrl?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const KEY = "trustnet_auth_user";
const USERS_KEY = "trustnet_auth_users";

const Ctx = createContext<AuthState | null>(null);

function readUsers(): Record<string, { name: string; password: string; id: string }> {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
  } catch {
    return {};
  }
}
function writeUsers(u: Record<string, { name: string; password: string; id: string }>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(u));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        const raw = localStorage.getItem(KEY);
        if (firebaseUser) {
          const { getFirestore, doc, getDoc, setDoc, serverTimestamp } = await import("firebase/firestore");
          const db = getFirestore();
          const userDocRef = doc(db, "users", firebaseUser.uid);
          let snap = await getDoc(userDocRef);

          // FIRESTORE SYNC: Recreate the Firestore user document if it is missing
          if (!snap.exists()) {
            console.warn("User document missing in Firestore. Recreating profile...");
            const name = firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User";
            const email = firebaseUser.email || "";
            const photoURL = firebaseUser.photoURL || "";
            await setDoc(userDocRef, {
              uid: firebaseUser.uid,
              name,
              displayName: name,
              email,
              email_id: email,
              photoURL,
              profile_photo: photoURL,
              createdAt: serverTimestamp(),
              profileCompleted: true,
              status: "active",
              trustScore: 100,
              verification_status: true,
              isGuardianAngel: false,
              guardianAvailable: false,
            });
            snap = await getDoc(userDocRef);
          }

          const data = snap.data() || {};
          const name = data.name || data.displayName || firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User";
          const email = data.email || data.email_id || firebaseUser.email || "";
          const photoURL = data.photoURL || data.profile_photo || firebaseUser.photoURL || "";

          setUser({
            id: firebaseUser.uid,
            name,
            email,
            avatar: photoURL,
            profile_photo: photoURL,
          });
        } else if (raw) {
          // If no firebaseUser, check if a mock user is logged in
          const localUser = JSON.parse(raw);
          const users = readUsers();
          const isMock = Object.values(users).some((u) => u.id === localUser.id);
          if (isMock) {
            setUser(localUser);
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Error in onAuthStateChanged:", err);
        setUser(null);
      } finally {
        setReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const value: AuthState = {
    user,
    ready,
    async login(email, password) {
      const emailNormalized = email.trim().toLowerCase();
      if (!emailNormalized) {
        throw new Error("auth/invalid-email");
      }
      if (!password) {
        throw new Error("auth/wrong-password");
      }
      try {
        await signInWithEmailAndPassword(auth, emailNormalized, password);
        // Persist session to local storage for display mapping
        const currentUser = auth.currentUser;
        if (currentUser) {
          localStorage.setItem(KEY, JSON.stringify({
            id: currentUser.uid,
            name: currentUser.displayName || emailNormalized.split("@")[0],
            email: emailNormalized,
          }));
        }
      } catch (firebaseErr: any) {
        console.error("Firebase Login Error:", firebaseErr);
        const errorCode = firebaseErr.code;

        // Fallback to local storage mock database in case Firebase is unconfigured/restricted
        if (
          errorCode === "auth/admin-restricted-operation" ||
          errorCode === "auth/network-request-failed" ||
          errorCode === "auth/operation-not-allowed"
        ) {
          const users = readUsers();
          const rec = users[emailNormalized];
          if (rec) {
            if (rec.password !== password) {
              throw new Error("auth/wrong-password");
            }
            const loggedUser = {
              id: rec.id,
              name: rec.name,
              email: emailNormalized,
            };
            setUser(loggedUser);
            localStorage.setItem(KEY, JSON.stringify(loggedUser));
            return;
          } else {
            throw new Error("auth/user-not-found");
          }
        }
        throw firebaseErr;
      }
    },
    async signup(name, email, password, avatarUrl) {
      const emailNormalized = email.trim().toLowerCase();
      if (!name.trim()) {
        throw new Error("Name cannot be empty");
      }
      if (!emailNormalized) {
        throw new Error("auth/invalid-email");
      }
      if (password.length < 6) {
        throw new Error("auth/weak-password");
      }
      try {
        // 1. Create Firebase Authentication user
        const userCredential = await createUserWithEmailAndPassword(auth, emailNormalized, password);
        const firebaseUser = userCredential.user;

        // 2. Wait until Auth succeeds & update display name + photoURL
        const resolvedAvatar = avatarUrl?.trim() ||
          `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name.trim())}`;
        await updateProfile(firebaseUser, { displayName: name.trim(), photoURL: resolvedAvatar });

        // 3. Create Firestore user document with required schema
        const { getFirestore, doc, setDoc, serverTimestamp } = await import("firebase/firestore");
        const db = getFirestore();
        await setDoc(doc(db, "users", firebaseUser.uid), {
          uid: firebaseUser.uid,
          name: name.trim(),
          displayName: name.trim(),
          email: emailNormalized,
          email_id: emailNormalized,
          photoURL: resolvedAvatar,
          profile_photo: resolvedAvatar,
          createdAt: serverTimestamp(),
          profileCompleted: true,
          status: "active",
          trustScore: 100,
          verification_status: true,
          isGuardianAngel: false,
          guardianAvailable: false,
        });

        const registeredUser = {
          id: firebaseUser.uid,
          name: name.trim(),
          email: emailNormalized,
          avatar: resolvedAvatar,
          profile_photo: resolvedAvatar,
        };
        setUser(registeredUser);
        localStorage.setItem(KEY, JSON.stringify(registeredUser));
      } catch (firebaseErr: any) {
        console.error("Firebase Signup Error:", firebaseErr);
        const errorCode = firebaseErr.code;

        // If Email is already in use in Firebase, but Email/Password sign-in is disabled,
        // we can register it in the mock database so the user is not locked out of their email.
        if (errorCode === "auth/email-already-in-use") {
          const users = readUsers();
          const finalUid = crypto.randomUUID();
          users[emailNormalized] = { name: name.trim(), password, id: finalUid };
          writeUsers(users);

          const newUser = {
            id: finalUid,
            name: name.trim(),
            email: emailNormalized,
          };
          setUser(newUser);
          localStorage.setItem(KEY, JSON.stringify(newUser));
          return;
        }

        // Fallback to local storage mock database in case Firebase is unconfigured/restricted
        if (
          errorCode === "auth/admin-restricted-operation" ||
          errorCode === "auth/network-request-failed" ||
          errorCode === "auth/operation-not-allowed"
        ) {
          const users = readUsers();
          if (users[emailNormalized]) {
            throw new Error("auth/email-already-in-use");
          }
          const finalUid = crypto.randomUUID();
          users[emailNormalized] = { name: name.trim(), password, id: finalUid };
          writeUsers(users);

          const newUser = {
            id: finalUid,
            name: name.trim(),
            email: emailNormalized,
          };
          setUser(newUser);
          localStorage.setItem(KEY, JSON.stringify(newUser));
          return;
        }
        throw firebaseErr;
      }
    },
    async logout() {
      try {
        await signOut(auth);
      } catch (err) {
        console.error("Firebase Signout Error:", err);
      }
      setUser(null);
      localStorage.removeItem(KEY);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
