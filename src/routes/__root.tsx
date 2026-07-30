import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import { useEffect, useRef, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "../lib/auth";

const TW_CONFIG = `tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "surface-container-low": "#f5f3f7",
        "secondary-fixed-dim": "#a5c8ff",
        "on-secondary-fixed": "#001c3a",
        "tertiary-container": "#9e45c4",
        "on-tertiary-fixed-variant": "#721199",
        "on-primary-fixed": "#002204",
        "on-primary-container": "#cbffc2",
        "on-background": "#1b1b1e",
        "surface-container": "#efedf1",
        "on-tertiary": "#ffffff",
        "surface": "#faf9fc",
        "error": "#ba1a1a",
        "surface-bright": "#faf9fc",
        "primary": "#0d631b",
        "surface-container-highest": "#e3e2e6",
        "on-secondary-fixed-variant": "#004786",
        "on-error-container": "#93000a",
        "error-container": "#ffdad6",
        "surface-container-high": "#e9e7eb",
        "tertiary-fixed-dim": "#ebb2ff",
        "secondary": "#005faf",
        "on-secondary-container": "#003567",
        "on-tertiary-fixed": "#320047",
        "primary-fixed": "#a3f69c",
        "inverse-surface": "#303033",
        "background": "#faf9fc",
        "outline": "#707a6c",
        "inverse-primary": "#88d982",
        "primary-fixed-dim": "#88d982",
        "inverse-on-surface": "#f2f0f4",
        "surface-variant": "#e3e2e6",
        "on-tertiary-container": "#feecff",
        "primary-container": "#2e7d32",
        "on-primary": "#ffffff",
        "surface-dim": "#dbd9dd",
        "on-surface": "#1b1b1e",
        "on-error": "#ffffff",
        "surface-container-lowest": "#ffffff",
        "tertiary": "#8228a9",
        "secondary-container": "#54a0fe",
        "outline-variant": "#bfcaba",
        "surface-tint": "#1b6d24",
        "tertiary-fixed": "#f8d8ff",
        "on-secondary": "#ffffff",
        "on-primary-fixed-variant": "#005312",
        "on-surface-variant": "#40493d",
        "secondary-fixed": "#d4e3ff"
      },
      borderRadius: { DEFAULT: "0.25rem", lg: "0.5rem", xl: "0.75rem", full: "9999px" },
      spacing: {
        "margin-tablet": "2rem",
        "stack-gap": "1.5rem",
        "gutter": "1rem",
        "margin-mobile": "1rem",
        "component-gap": "0.75rem"
      },
      fontFamily: {
        "body-md": ["Inter"], "body-lg": ["Inter"], "label-md": ["Inter"],
        "title-md": ["Inter"], "headline-lg": ["Inter"], "label-lg": ["Inter"],
        "headline-md": ["Inter"], "title-lg": ["Inter"], "headline-lg-mobile": ["Inter"]
      },
      fontSize: {
        "body-md": ["14px", { lineHeight: "20px", letterSpacing: "0.25px", fontWeight: "400" }],
        "body-lg": ["16px", { lineHeight: "24px", letterSpacing: "0.5px", fontWeight: "400" }],
        "label-md": ["12px", { lineHeight: "16px", letterSpacing: "0.5px", fontWeight: "500" }],
        "title-md": ["16px", { lineHeight: "24px", letterSpacing: "0.15px", fontWeight: "600" }],
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "label-lg": ["14px", { lineHeight: "20px", letterSpacing: "0.1px", fontWeight: "500" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "title-lg": ["22px", { lineHeight: "28px", fontWeight: "600" }],
        "headline-lg-mobile": ["28px", { lineHeight: "36px", letterSpacing: "-0.02em", fontWeight: "700" }]
      }
    }
  }
};`;

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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-4 rounded bg-black px-4 py-2 text-white"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
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
      { src: "https://cdn.tailwindcss.com?plugins=forms,container-queries" },
      { children: TW_CONFIG },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="light">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const NAV = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/heatmap", label: "Heatmap", icon: "map" },
  { to: "/sos", label: "SOS", icon: "sos" },
  { to: "/circle", label: "Circle", icon: "group" },
  { to: "/guardian", label: "Guardian", icon: "security" },
  { to: "/profile", label: "Profile", icon: "person" },
] as const;

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

const ICON_ROUTES: Record<string, string> = {
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

const TEXT_ROUTES: Array<[RegExp, string]> = [
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

function isSosButton(el: Element | null): boolean {
  if (!el) return false;
  if ((el as HTMLElement).closest("nav[data-bottom-nav]")) return false;
  const text = (el.textContent || "").trim().toUpperCase();
  return text === "SOS";
}

const HOLD_MS = 1500;

function ClickRouter({ onSosArm }: { onSosArm: () => void }) {
  const router = useRouter();
  const { logout } = useAuth();
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        typeof window !== "undefined" &&
        (window.location.pathname.startsWith("/sos-receiver") ||
          window.location.pathname.startsWith("/sos"))
      ) {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const actionable = target.closest("button, a, [role='button']") as HTMLElement | null;
      if (!actionable) return;
      if (actionable.closest("nav[data-bottom-nav]")) return;
      if (
        actionable.tagName === "A" &&
        (actionable as HTMLAnchorElement).getAttribute("href") &&
        (actionable as HTMLAnchorElement).getAttribute("href") !== "#"
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
    const down = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
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

function SosHoldOverlay({
  active,
  onCancel,
  onComplete,
}: {
  active: boolean;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);

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
      <ClickRouter onSosArm={() => setSosActive(true)} />
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
