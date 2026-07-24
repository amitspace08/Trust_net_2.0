import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "TrustNet — Sign In" }] }),
  component: LoginPage,
});

export function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return; // Prevent multiple clicks

    setErr(null);
    setSuccess(false);

    const emailTrimmed = email.trim();
    const emailNormalized = emailTrimmed.toLowerCase();

    // 1. Email format validation
    if (!emailNormalized) {
      setErr("Please enter an email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized)) {
      setErr("Please enter a valid email address.");
      return;
    }

    // 2. Password non-empty validation
    if (!password) {
      setErr("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      await login(emailNormalized, password);
      setSuccess(true);
      
      // Delay navigation slightly to let the user see the success message
      setTimeout(() => {
        router.navigate({ to: "/" });
      }, 1000);
    } catch (loginErr: any) {
      console.error("Login Page Error:", loginErr);
      const code = loginErr.code || loginErr.message || "";

      // 3. Robust Error Mapping
      if (code === "auth/wrong-password" || code === "Incorrect password") {
        setErr("Incorrect password.");
      } else if (code === "auth/user-not-found") {
        setErr("No account found with this email.");
      } else if (code === "auth/invalid-credential") {
        // Distinguish wrong password from wrong email under email enumeration protection
        try {
          const { getFirestore, collection, query, where, getDocs } = await import("firebase/firestore");
          const db = getFirestore();
          const q = query(collection(db, "users"), where("email_id", "==", emailNormalized));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setErr("Incorrect password.");
          } else {
            setErr("No account found with this email.");
          }
        } catch (dbErr) {
          console.warn("Failed to check email in Firestore during error mapping:", dbErr);
          setErr("No account found with this email.");
        }
      } else if (code === "auth/invalid-email") {
        setErr("Please enter a valid email address.");
      } else if (code === "auth/user-disabled") {
        setErr("This account has been disabled.");
      } else if (code === "auth/too-many-requests") {
        setErr("Too many failed attempts. Please try again later.");
      } else if (code === "auth/network-request-failed" || code.includes("network")) {
        setErr("Network error. Please try again.");
      } else {
        setErr("Failed to sign in. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9fc] p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-7">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <span
            className="material-symbols-outlined text-[#0d631b] text-3xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            shield_with_heart
          </span>
          <span className="text-2xl font-bold text-[#0d631b] tracking-tight">TrustNet</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="text-sm text-gray-500 mt-1">Sign in to your TrustNet safety account.</p>

        <form onSubmit={handleLoginSubmit} className="mt-6 flex flex-col gap-4">
          <label className="text-sm text-gray-700 flex flex-col gap-1">
            Email
            <input
              type="email"
              required
              disabled={loading || success}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#0d631b]/40 disabled:bg-gray-50"
              placeholder="name@example.com"
            />
          </label>

          <label className="text-sm text-gray-700 flex flex-col gap-1">
            Password
            <input
              type="password"
              required
              disabled={loading || success}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#0d631b]/40 disabled:bg-gray-50"
              placeholder="••••••••"
            />
          </label>

          {err && <p className="text-sm text-red-600 font-medium mt-1">{err}</p>}
          {success && <p className="text-sm text-emerald-600 font-semibold mt-1">Login successful! Redirecting…</p>}

          <button
            type="submit"
            disabled={loading || success}
            className="mt-2 bg-[#0d631b] text-white font-semibold py-2.5 rounded-full hover:bg-[#0a4f15] active:scale-[0.98] transition disabled:opacity-60 cursor-pointer text-center flex items-center justify-center"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin mr-2" />
                Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </button>

          <p className="text-xs text-gray-500 text-center mt-3">
            New to TrustNet?{" "}
            <Link to="/signup" className="text-[#0d631b] hover:underline font-semibold">
              Create an account
            </Link>
          </p>

          <button
            type="button"
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="text-[10px] text-gray-400 hover:text-red-500 hover:underline mt-4 block mx-auto bg-transparent border-none cursor-pointer"
          >
            Reset Local Database (Clear Cache)
          </button>
        </form>
      </div>
    </div>
  );
}
