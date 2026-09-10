import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "TrustNet - Sign In" }] }),
  component: LoginPage,
});

export function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleLoginSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (loading) return;

    setErr(null);
    setSuccess(false);

    try {
      const emailTrimmed = email ? String(email).trim() : "";
      const emailNormalized = emailTrimmed.toLowerCase();

      if (!emailNormalized) {
        setErr("Please enter an email address.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized)) {
        setErr("Please enter a valid email address.");
        return;
      }
      if (!password) {
        setErr("Please enter your password.");
        return;
      }

      setLoading(true);
      await login(emailNormalized, password);
      
      setSuccess(true);
      setTimeout(() => {
        try {
          router.navigate({ to: "/" });
        } catch(e) {}
      }, 500);

    } catch (loginErr) {
      console.error("Login Page Error:", loginErr);
      const code = loginErr?.code || loginErr?.message || "";
      if (code === "auth/wrong-password" || code === "auth/user-not-found") {
        setErr("Invalid email or password.");
      } else if (code === "auth/too-many-requests") {
        setErr("Too many failed attempts. Please try again later.");
      } else if (code.includes("network") || code.includes("Network") || code.includes("failed")) {
        setErr("Unable to connect to server.");
      } else {
        setErr("Invalid email or password.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9fc] p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-7">
        <div className="flex flex-col items-center justify-center mb-6">
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
          {success && (
            <p className="text-sm text-emerald-600 font-semibold mt-1">
              Login successful! Redirecting…
            </p>
          )}

          <button
            type="button"
            onClick={handleLoginSubmit}
            disabled={loading || success}
            className="mt-2 w-full bg-[#0d631b] text-white font-semibold py-2.5 rounded-full hover:bg-[#0a4f15] active:scale-[0.98] transition disabled:opacity-60 cursor-pointer text-center flex items-center justify-center"
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
            <a href="/signup" className="text-[#0d631b] hover:underline font-semibold">
              Create an account
            </a>
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
