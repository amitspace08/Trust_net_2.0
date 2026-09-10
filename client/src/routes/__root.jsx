import { QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  Navigate,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "../lib/auth";
import { UserAvatar } from "../components/ui/UserAvatar";

;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-2 text-sm">Page not found</p>
        <Link to="/" className="mt-6 inline-block underline">
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-red-600">Something went wrong</h1>
        <p className="mt-4 text-sm text-gray-800 bg-red-50 p-4 border border-red-200 rounded text-left overflow-auto max-h-64 whitespace-pre-wrap">
          {error?.message || "Unknown error"}
          {"\n\n"}
          {error?.stack || ""}
        </p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded bg-black px-4 py-2 text-white"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "TrustNet" },
      { name: "description", content: "TrustNet — personal safety app" },
    ],

    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap",
      },
    ],

    scripts: [
      
      
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }) {
  return (
    <div className="light">
      <HeadContent />
      {children}
      <Scripts />
    </div>
  );
}

const NAV = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/heatmap", label: "Heatmap", icon: "map" },
  { to: "/sos", label: "SOS", icon: "sos" },
  { to: "/circle", label: "Circle", icon: "group" },
  { to: "/guardian", label: "Guardian", icon: "security" },
  { to: "/profile", label: "Profile", icon: "person" },
];

function BottomNav() {
  return (
    <nav
      data-bottom-nav
      className="fixed bottom-0 left-0 right-0 z-[100] flex justify-around items-center bg-white/95 backdrop-blur border-t border-gray-200 h-16 md:hidden"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      {NAV.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          className="flex flex-col items-center justify-center text-[11px] text-gray-600 [&.active]:text-[#0d631b] [&.active]:font-semibold"
          activeProps={{ className: "active" }}
          activeOptions={{ exact: true }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
            {n.icon}
          </span>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

function Sidebar({ user }) {
  const avatarUrl = user?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || "U"}&backgroundColor=f97316`;

  return (
    <nav className="hidden md:flex flex-col bg-white text-gray-800 h-full rounded-r-2xl shadow-sm border-r border-gray-150 w-72 max-w-[80vw] p-5 fixed left-0 top-0 z-50">
      <div className="flex items-center gap-4 mb-8 pt-4">
        <UserAvatar
          name={user?.name || "User"}
          avatarUrl={avatarUrl}
          sizeClassName="w-12 h-12 text-base font-semibold"
          className="border border-gray-100"
        />

        <div>
          <h2 className="text-sm font-bold text-gray-900">{user?.name || user?.displayName || "User"}</h2>
          <p className="text-xs text-gray-500">Trust Score: 98</p>
          <p className="text-xs text-[#0d631b] font-semibold mt-0.5">Safety Status: Protected</p>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5">
        {[
          { to: "/settings", label: "Emergency Settings", icon: "settings_ethernet" },
          { to: "/history", label: "Safety History", icon: "history" },
          { to: "/privacy", label: "Privacy Guard", icon: "privacy_tip" },
          { to: "/support", label: "Support", icon: "help" }
        ].map(item => (
          <li key={item.to}>
            <Link
              to={item.to}
              className="flex items-center gap-3 px-4 py-2.5 rounded-full transition-all text-sm group"
              activeProps={{ className: "bg-[#0d631b]/10 text-[#0d631b] font-bold" }}
              inactiveProps={{ className: "text-gray-600 hover:bg-gray-100 font-medium" }}
            >
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-auto">
        <ul className="flex flex-col gap-1.5">
          {[
            { to: "/", label: "Home", icon: "home", exact: true },
            { to: "/heatmap", label: "Heatmap", icon: "map" },
            { to: "/circle", label: "Circle", icon: "group" },
            { to: "/guardian", label: "Guardian", icon: "security" },
            { to: "/profile", label: "Profile", icon: "person" }
          ].map(item => (
            <li key={item.to}>
              <Link
                to={item.to}
                activeOptions={item.exact ? { exact: true } : {}}
                className="flex items-center gap-3 px-4 py-2.5 rounded-full transition-all text-sm group"
                activeProps={{ className: "bg-[#0d631b]/10 text-[#0d631b] font-bold" }}
                inactiveProps={{ className: "text-gray-600 hover:bg-gray-100 font-medium" }}
              >
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

const ICON_ROUTES = {
  home: "/",
  map: "/heatmap",
  pin_drop: "/heatmap",
  location_on: "/heatmap",
  group: "/circle",
  groups: "/circle",
  people: "/circle",
  group_add: "/add-contact",
  person_add: "/add-contact",
  security: "/guardian",
  shield_with_heart: "/guardian",
  verified_user: "/guardian",
  sos: "/sos",
  emergency: "/sos",
  person: "/profile",
  account_circle: "/profile",
  settings: "/settings",
  settings_ethernet: "/settings",
  history: "/history",
  privacy_tip: "/privacy",
  help: "/support",
  notifications: "/notifications",
  notifications_active: "/notifications",
  report: "/report",
  report_problem: "/report",
  flag: "/report",
  warning: "/report",
  check_circle: "/check-in",
  task_alt: "/check-in",
};

const TEXT_ROUTES = [
  [/^i am safe/i, "/check-in"],
  [/cancel sos/i, "/"],
  [/check\s*in/i, "/check-in"],
  [/report (an? )?incident|view all .* reports/i, "/report"],
  [/add (a )?(contact|member|friend)/i, "/add-contact"],
  [/\bnotifications?\b/i, "/notifications"],
  [/\bsettings\b/i, "/settings"],
  [/\bheatmap\b/i, "/heatmap"],
  [/\bcircle\b/i, "/circle"],
  [/\bguardian\b/i, "/guardian"],
  [/\bprofile\b/i, "/profile"],
  [/\bhistory\b/i, "/history"],
  [/\bprivacy\b/i, "/privacy"],
  [/\bsupport\b|\bhelp\b/i, "/support"],
  [/\bhome\b/i, "/"],
];

const LOGOUT_RE = /\b(log\s*out|sign\s*out|logout|signout)\b/i;

function isSosButton(el) {
  if (!el) return false;
  if (el.closest("nav[data-bottom-nav]")) return false;
  const text = (el.textContent || "").trim().toUpperCase();
  return text === "SOS";
}

const HOLD_MS = 1500;

function ClickRouter({ onSosArm }) {
  const router = useRouter();
  const { logout } = useAuth();
  useEffect(() => {
    const handler = (e) => {
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        if (
          path.startsWith("/sos-receiver") ||
          path.startsWith("/sos") ||
          path.startsWith("/login") ||
          path.startsWith("/signup")
        ) {
          return;
        }
      }
      const target = e.target;
      if (!target) return;
      const actionable = target.closest("button, a, [role='button']");
      if (!actionable) return;
      if (actionable.closest("nav[data-bottom-nav]")) return;
      if (
        actionable.tagName === "A" &&
        actionable.getAttribute("href") &&
        actionable.getAttribute("href") !== "#"
      )
        return;
      if (isSosButton(actionable)) {
        e.preventDefault();
        return;
      }

      const text = (actionable.textContent || "").trim();
      if (LOGOUT_RE.test(text)) {
        e.preventDefault();
        logout();
        router.navigate({ to: "/login" });
        return;
      }

      const icons = actionable.querySelectorAll(".material-symbols-outlined");
      for (const icon of Array.from(icons)) {
        const name = (icon.textContent || "").trim().toLowerCase();
        if (name === "logout") {
          e.preventDefault();
          logout();
          router.navigate({ to: "/login" });
          return;
        }
        if (ICON_ROUTES[name]) {
          e.preventDefault();
          router.navigate({ to: ICON_ROUTES[name] });
          return;
        }
      }
      const lower = text.toLowerCase();
      for (const [re, to] of TEXT_ROUTES) {
        if (re.test(lower)) {
          e.preventDefault();
          router.navigate({ to });
          return;
        }
      }
    };
    const down = (e) => {
      const target = e.target;
      const btn = target?.closest("button") ?? null;
      if (isSosButton(btn)) onSosArm();
    };
    document.addEventListener("click", handler);
    document.addEventListener("pointerdown", down);
    return () => {
      document.removeEventListener("click", handler);
      document.removeEventListener("pointerdown", down);
    };
  }, [router, onSosArm, logout]);
  return null;
}

function SosHoldOverlay({ active, onCancel, onComplete }) {
  const [progress, setProgress] = useState(0);
  const startRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      return;
    }
    startRef.current = performance.now();
    let done = false;
    const tick = () => {
      const p = Math.min(1, (performance.now() - startRef.current) / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        done = true;
        onComplete();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    const cancel = () => {
      if (!done) onCancel();
    };
    window.addEventListener("pointerup", cancel);
    window.addEventListener("pointercancel", cancel);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("pointerup", cancel);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [active, onCancel, onComplete]);

  if (!active) return null;
  const r = 70;
  const c = 2 * Math.PI * r;
  const seconds = Math.max(0, Math.ceil((1 - progress) * (HOLD_MS / 1000)));
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm select-none animate-fade-in"
      style={{ touchAction: "none" }}
    >
      <div className="relative w-52 h-52">
        {/* Pulsing outer ring */}
        <span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
        <span className="absolute inset-2 rounded-full bg-red-500/10 animate-pulse" />

        {/* Progress ring */}
        <svg className="w-full h-full -rotate-90 relative" viewBox="0 0 160 160">
          <circle
            cx="80"
            cy="80"
            r={r}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="10"
            fill="none"
          />

          <circle
            cx="80"
            cy="80"
            r={r}
            stroke="#ef4444"
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={Math.round(c)}
            strokeDashoffset={Math.round(c * (1 - progress))}
            style={{ transition: "stroke-dashoffset 60ms linear" }}
          />
        </svg>

        {/* Spinner loader */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="absolute w-32 h-32 rounded-full border-2 border-transparent border-t-white/80 border-r-white/40 animate-spin"
            style={{ animationDuration: "0.9s" }}
          />
        </div>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
          <span className="material-symbols-outlined text-red-400" style={{ fontSize: 36 }}>
            sos
          </span>
          <span className="text-5xl font-extrabold tracking-widest mt-1">{seconds}</span>
          <span className="text-[10px] uppercase tracking-[0.3em] mt-1 text-white/70">Hold</span>
        </div>
      </div>

      {/* Linear loader bar */}
      <div className="mt-8 w-56 h-1.5 rounded-full bg-white/15 overflow-hidden">
        <div
          className="h-full bg-[#ef4444] rounded-full"
          style={{ width: `${progress * 100}%`, transition: "width 60ms linear" }}
        />
      </div>

      <p className="text-white/90 text-sm mt-5 font-semibold tracking-wide uppercase">
        Activating SOS…
      </p>
      <p className="text-white/60 text-xs mt-1">Release to cancel</p>
    </div>
  );
}

const PUBLIC_PATHS = new Set(["/login", "/signup"]);

import { useLiveLocationTracker } from "../hooks/useLiveLocationTracker";

function AuthGate() {
  const { user, ready } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const [sosActive, setSosActive] = useState(false);

  // Track location in background if enabled
  useLiveLocationTracker();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9fc]">
        <div className="w-10 h-10 rounded-full border-4 border-[#0d631b]/20 border-t-[#0d631b] animate-spin" />
      </div>
    );
  }

  const isPublic = PUBLIC_PATHS.has(pathname);
  if (!user && !isPublic) return <Navigate to="/login" />;
  if (user && isPublic) return <Navigate to="/" />;

  return (
    <>
      {user && <Sidebar user={user} />}
      {user && !pathname.startsWith("/sos") && (
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200 flex justify-between items-center px-4 h-16 w-full md:hidden">
          <div className="flex items-center gap-3">
            <button className="w-10 h-10 flex items-center justify-center rounded-full text-[#0d631b] hover:bg-gray-100 transition">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>shield_with_heart</span>
            </button>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">TrustNet</h1>
          </div>
          <Link to="/notifications" className="w-10 h-10 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 transition">
            <span className="material-symbols-outlined">notifications</span>
          </Link>
        </header>
      )}
      <Outlet />
      {user && <BottomNav />}
      <SosHoldOverlay
        active={sosActive}
        onCancel={() => setSosActive(false)}
        onComplete={() => {
          setSosActive(false);
          router.navigate({ to: "/sos" });
        }}
      />
    </>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </QueryClientProvider>
  );
}
