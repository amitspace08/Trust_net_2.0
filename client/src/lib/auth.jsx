import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";

const KEY = "trustnet_auth_user";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function initAuth() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const stored = JSON.parse(raw);
          if (stored && stored.token) {
            const res = await api.get("/auth/me");
            if (res.data.success) {
              setUser({
                id: res.data.user.id,
                uid: res.data.user.id,
                name: res.data.user.name,
                displayName: res.data.user.name,
                email: res.data.user.email,
                token: stored.token
              });
            } else {
              localStorage.removeItem(KEY);
            }
          }
        }
      } catch (err) {
        console.error("Auth init error:", err);
        localStorage.removeItem(KEY);
      } finally {
        setReady(true);
      }
    }
    initAuth();
  }, []);

  const value = {
    user,
    ready,
    async login(email, password) {
      const emailNormalized = email.trim().toLowerCase();
      if (!emailNormalized || !password) {
        throw new Error("Invalid credentials");
      }
      try {
        const res = await api.post("/auth/login", { email: emailNormalized, password });
        const loggedUser = {
          id: res.data.user.id,
          uid: res.data.user.id,
          name: res.data.user.name,
          displayName: res.data.user.name,
          email: res.data.user.email,
          token: res.data.token,
        };
        setUser(loggedUser);
        localStorage.setItem(KEY, JSON.stringify(loggedUser));
      } catch (err) {
        console.error("REST Login Error:", err);
        const status = err.response?.status;
        if (status === 401 || status === 400 || status === 404) {
            const error = new Error("auth/wrong-password");
            error.code = "auth/wrong-password";
            throw error;
        }
        throw err;
      }
    },
    async signup(name, email, password, avatarUrl) {
      const emailNormalized = email.trim().toLowerCase();
      try {
        const res = await api.post("/auth/register", {
          displayName: name,
          email: emailNormalized,
          password,
        });
        const loggedUser = {
          id: res.data.user.id,
          uid: res.data.user.id,
          name: res.data.user.name,
          displayName: res.data.user.name,
          email: res.data.user.email,
          token: res.data.token,
        };
        setUser(loggedUser);
        localStorage.setItem(KEY, JSON.stringify(loggedUser));
      } catch (err) {
        console.error("REST Signup Error:", err);
        if (err.response?.data?.message === "User already exists") {
          const error = new Error("auth/email-already-in-use");
          error.code = "auth/email-already-in-use";
          throw error;
        }
        throw err;
      }
    },
    async logout() {
      setUser(null);
      localStorage.removeItem(KEY);
      localStorage.removeItem("trustnet_active_sos_session");
      localStorage.removeItem("trustnet_sos_state");
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const context = useContext(Ctx);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
