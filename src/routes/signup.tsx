import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "TrustNet — Sign Up" }] }),
  component: SignupPage,
});

export function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSignupSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return; // Prevent multiple clicks

    setErr(null);
    setSuccess(false);

    const nameTrimmed = name.trim();
    const emailTrimmed = email.trim();
    const emailNormalized = emailTrimmed.toLowerCase();

    // 1. Validate full name
    if (!nameTrimmed) {
      setErr("Please enter your full name.");
      return;
    }

    // 2. Validate email
    if (!emailNormalized) {
      setErr("Please enter an email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized)) {
      setErr("Please enter a valid email address.");
      return;
    }

    // 3. Validate password length
    if (!password) {
      setErr("Please enter a password.");
      return;
    }
    if (password.length < 6) {
      setErr("Password should be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await signup(nameTrimmed, emailNormalized, password);
      setSuccess(true);
      
      // Delay navigation slightly to let the user see the success message
      setTimeout(() => {
        router.navigate({ to: "/" });
      }, 1000);
    } catch (signupErr: any) {
      console.error("Signup Page Error:", signupErr);
      const code = signupErr.code || signupErr.message || "";

      // 4. Robust Error Mapping
      if (code === "auth/email-already-in-use" || code === "An account already exists for this email") {
        setErr("An account already exists for this email.");
      } else if (code === "auth/invalid-email") {
        setErr("Please enter a valid email address.");
      } else if (code === "auth/weak-password") {
        setErr("Password should be at least 6 characters.");
      } else if (code === "auth/network-request-failed" || code.includes("network")) {
        setErr("Network error. Please try again.");
      } else {
        setErr("Failed to create account. Please try again.");
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

        <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
        <p className="text-sm text-gray-500 mt-1">Join the TrustNet safety network.</p>

        <form onSubmit={handleSignupSubmit} className="mt-6 flex flex-col gap-4">
          <label className="text-sm text-gray-700 flex flex-col gap-1">
            Full name
            <input
              type="text"
              required
              disabled={loading || success}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#0d631b]/40 disabled:bg-gray-50"
              placeholder="Alex Mercer"
            />
          </label>

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
              placeholder="At least 6 characters"
            />
          </label>

          {err && <p className="text-sm text-red-600 font-medium mt-1">{err}</p>}
          {success && <p className="text-sm text-emerald-600 font-semibold mt-1">Account created! Redirecting…</p>}

          <button
            type="submit"
            disabled={loading || success}
            className="mt-2 bg-[#0d631b] text-white font-semibold py-2.5 rounded-full hover:bg-[#0a4f15] active:scale-[0.98] transition disabled:opacity-60 cursor-pointer text-center flex items-center justify-center"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin mr-2" />
                Creating account…
              </>
            ) : (
              "Create Account"
            )}
          </button>

          <p className="text-xs text-gray-500 text-center mt-3">
            Already have an account?{" "}
            <Link to="/login" className="text-[#0d631b] hover:underline font-semibold">
              Sign In
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
