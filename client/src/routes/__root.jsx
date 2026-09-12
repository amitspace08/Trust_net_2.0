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

function Sidebar({ user, isOpen, onClose }) {
  const avatarUrl = user?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || "U"}&backgroundColor=f97316`;

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden animate-fade-in" 
          onClick={onClose}
        />
      )}

      {/* Sidebar Navigation */}
      <nav 
        className={`
          fixed md:sticky top-0 left-0 z-50 h-screen bg-white text-gray-800 flex flex-col 
          shadow-lg md:shadow-sm border-r border-gray-150 overflow-y-auto transition-transform duration-300 ease-in-out
          w-[280px] md:w-[240px] lg:w-[260px] shrink-0
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="flex items-center gap-4 mb-8 p-5 pt-8 md:pt-6">
          <UserAvatar
            name={user?.name || "User"}
            avatarUrl={avatarUrl}
            sizeClassName="w-12 h-12 text-base font-semibold"
            className="border border-gray-100"
          />

          <div className="min-w-0">
            <h2 className="text-sm font-bold text-gray-900 truncate">{user?.name || user?.displayName || "User"}</h2>
            <p className="text-xs text-gray-500 truncate">TrustNet Protected</p>
            <p className="text-xs text-[#0d631b] font-semibold mt-0.5 truncate">Safety Status: Secure</p>
          </div>
        </div>

        <ul className="flex flex-col gap-1 px-3">
          {[
            { to: "/settings", label: "Emergency Settings", icon: "settings_ethernet" },
            { to: "/history", label: "Safety History", icon: "history" },
            { to: "/privacy", label: "Privacy Guard", icon: "privacy_tip" },
            { to: "/support", label: "Support", icon: "help" }
          ].map(item => (
            <li key={item.to}>
              <Link
                to={item.to}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm group"
                activeProps={{ className: "bg-[#0d631b]/10 text-[#0d631b] font-bold" }}
                inactiveProps={{ className: "text-gray-600 hover:bg-gray-100 font-medium" }}
              >
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-auto p-3 mb-4">
          <ul className="flex flex-col gap-1">
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
                  onClick={onClose}
                  activeOptions={item.exact ? { exact: true } : {}}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm group"
                  activeProps={{ className: "bg-[#0d631b]/10 text-[#0d631b] font-bold" }}
                  inactiveProps={{ className: "text-gray-600 hover:bg-gray-100 font-medium" }}
                >
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Track location in background if enabled
  useLiveLocationTracker();

  const [incomingSOS, setIncomingSOS] = useState(null);

  // Listen for incoming SOS globally
  useEffect(() => {
    if (!user) return;
    
    let unsubscribe = () => {};
    
    const initListener = async () => {
      const { collection, query, where, onSnapshot } = await import("firebase/firestore");
      const { db } = await import("../firebase/firebase");
      
      const q = query(
        collection(db, "notifications"),
        where("receiverUID", "==", user.id),
        where("read", "==", false)
      );
      
      unsubscribe = onSnapshot(q, (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            if (data.type === "SOS" || data.type === "LAYER2_SOS" || data.type === "LAYER3_SOS") {
              if (data.deepLink) {
                // Don't show the global modal if they are already on the receiver page
                // OR if it's a LAYER3_SOS and they are already on the Guardian dashboard (which has its own alert UI)
                if (!window.location.href.includes("sos-receiver") && !(data.type === "LAYER3_SOS" && window.location.pathname.includes("/guardian"))) {
                   setIncomingSOS({ id: change.doc.id, ...data });
                }
              }
            }
          }
        });
      });
    };
    
    initListener();
    return () => unsubscribe();
  }, [user]);

  // Listen to the specific SOS session if a modal is open, to auto-update if someone else answers
  useEffect(() => {
    if (!incomingSOS) return;
    
    let sessionId = incomingSOS.sessionId;
    if (!sessionId && incomingSOS.deepLink) {
       const urlParams = new URLSearchParams(incomingSOS.deepLink.split('?')[1]);
       sessionId = urlParams.get('sessionId');
    }
    
    if (!sessionId) return;

    let unsubscribe = () => {};

    const watchSession = async () => {
      const { doc, onSnapshot } = await import("firebase/firestore");
      const { db } = await import("../firebase/firebase");
      
      unsubscribe = onSnapshot(doc(db, "sos_sessions", sessionId), (snap) => {
        if (snap.exists()) {
          const session = snap.data();
          if (session.status === "ended" || session.status === "cancelled") {
            setIncomingSOS(prev => prev ? { ...prev, sessionState: "ended" } : null);
          } else if (session.responderUID) {
            setIncomingSOS(prev => prev ? { ...prev, sessionState: "accepted" } : null);
          }
        } else {
          setIncomingSOS(prev => prev ? { ...prev, sessionState: "ended" } : null);
        }
      });
    };

    watchSession();
    return () => unsubscribe();
  }, [incomingSOS?.id, user?.id]);

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
    <div className="flex min-h-screen bg-gray-50/30 w-full">
      {user && <Sidebar user={user} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />}
      <div className="flex-1 flex flex-col min-w-0 w-full relative">
        {user && !pathname.startsWith("/sos") && (
          <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200 flex justify-between items-center px-4 h-16 w-full md:hidden">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="w-10 h-10 flex items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 transition -ml-1"
              >
                <span className="material-symbols-outlined">menu</span>
              </button>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#0d631b]" style={{ fontVariationSettings: "'FILL' 1" }}>shield_with_heart</span>
                <h1 className="text-lg font-bold text-gray-900 tracking-tight">TrustNet</h1>
              </div>
            </div>
            <Link to="/notifications" className="w-10 h-10 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 transition">
              <span className="material-symbols-outlined">notifications</span>
            </Link>
          </header>
        )}
        <Outlet />
        {user && <BottomNav />}
      </div>
      <SosHoldOverlay
        active={sosActive}
        onCancel={() => setSosActive(false)}
        onComplete={() => {
          setSosActive(false);
          router.navigate({ to: "/sos" });
        }}
      />
      {incomingSOS && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-scale-in">
            <div className={`p-4 text-white text-center ${
              incomingSOS.sessionState === "accepted" ? "bg-blue-600" 
              : incomingSOS.sessionState === "ended" ? "bg-green-600" 
              : incomingSOS.type === "LAYER3_SOS" ? "bg-amber-600" // Guardian Orange!
              : "bg-red-600"
            }`}>
              <span className="material-symbols-outlined text-4xl mb-1">
                {incomingSOS.sessionState === "accepted" ? "handshake" 
                  : incomingSOS.sessionState === "ended" ? "shield" 
                  : incomingSOS.type === "LAYER3_SOS" ? "security" // Guardian Icon!
                  : "emergency_home"}
              </span>
              <h2 className="text-lg font-bold">
                {incomingSOS.sessionState === "accepted" ? "Help is on the way" 
                  : incomingSOS.sessionState === "ended" ? "User is safe" 
                  : (incomingSOS.title || "Emergency Alert")}
              </h2>
            </div>
            <div className="p-5 text-center">
              <p className="text-gray-700 text-sm mb-6">
                {incomingSOS.sessionState === "accepted"
                  ? "Another member of the TrustNet network has already accepted this SOS and is responding."
                  : incomingSOS.sessionState === "ended"
                  ? "This emergency has been resolved or cancelled by the user."
                  : (incomingSOS.message || "Someone in your network needs help.")}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    const { markNotificationRead } = await import("../services/readNotification");
                    markNotificationRead(incomingSOS.id).catch(console.error);
                    setIncomingSOS(null);
                  }}
                  className={`flex-1 py-3 font-bold rounded-xl transition ${
                    incomingSOS.sessionState ? "bg-gray-100 hover:bg-gray-200 text-gray-700" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  Dismiss
                </button>
                {!incomingSOS.sessionState && (
                  <button
                    onClick={async () => {
                      const { markNotificationRead } = await import("../services/readNotification");
                      markNotificationRead(incomingSOS.id).catch(console.error);
                      router.navigate({ to: incomingSOS.deepLink });
                      setIncomingSOS(null);
                    }}
                    className={`flex-1 py-3 text-white font-bold rounded-xl transition shadow ${
                      incomingSOS.type === "LAYER3_SOS" 
                        ? "bg-amber-600 hover:bg-amber-700" 
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    Help Now
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
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
