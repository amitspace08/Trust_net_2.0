import { useAuth } from "./auth";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

function timeGreeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

// Indian map embed (OpenStreetMap, centered on Bengaluru MG Road area)
const INDIA_MAP_IFRAME = `<iframe
  title="India Map"
  class="absolute inset-0 w-full h-full border-0"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
  src="https://www.openstreetmap.org/export/embed.html?bbox=77.5800%2C12.9550%2C77.6300%2C12.9900&layer=mapnik&marker=12.9716%2C77.5946"
></iframe>`;

function indianize(html) {
  let out = html;
  // Swap static map images for a live OSM embed of an Indian city
  out = out.replace(/<img\b[^>]*data-location="[^"]*"[^>]*>/gi, INDIA_MAP_IFRAME);
  // Location names
  out = out.replace(/Downtown Transit Hub/g, "MG Road Metro Hub");
  out = out.replace(/Downtown/g, "MG Road");
  out = out.replace(/\bLondon\b/g, "Bengaluru");
  out = out.replace(/\bNew York\b/g, "Mumbai");
  out = out.replace(/\bManhattan\b/g, "Bandra");
  // Units: miles → km
  out = out.replace(
    /(\d+(?:\.\d+)?)\s*miles?\b/gi,
    (_m, n) => `${(parseFloat(n) * 1.609).toFixed(1)} km`,
  );
  // Currency
  out = out.replace(/\$(\d)/g, "₹$1");
  return out;
}

function addInteractivity(html) {
  let out = html;

  // Tactile press + ripple class to all buttons
  out = out.replace(/<button(\s[^>]*?)class="([^"]*)"/g, (m, attrs, c) => {
    if (/\btn-btn\b/.test(c)) return m;
    return `<button${attrs}class="${c} tn-btn"`;
  });

  // Card lift on common rounded container backgrounds
  out = out.replace(
    /class="((?:[^"]*\s)?bg-(?:surface-container[\w-]*|primary-container|secondary-container|tertiary-container|surface-container-lowest|surface-container-low)\b[^"]*)"/g,
    (m, c) => {
      if (/\btn-card\b/.test(c)) return m;
      return `class="${c} tn-card"`;
    },
  );

  // Subtle rise-in for major rounded blocks
  out = out.replace(/class="((?:[^"]*\s)?rounded-xl\b[^"]*)"/g, (m, c) => {
    if (/\btn-rise\b/.test(c)) return m;
    return `class="${c} tn-rise"`;
  });

  return out;
}

const INTERACTIVE_CSS = `
<style>
@keyframes tn-rise-kf { from { opacity: 0; transform: translateY(8px);} to { opacity: 1; transform: translateY(0);} }
.tn-rise { animation: tn-rise-kf .5s cubic-bezier(.16,1,.3,1) both; }
.tn-card { transition: transform .25s cubic-bezier(.16,1,.3,1), box-shadow .25s ease, background-color .2s ease; }
.tn-card:hover { transform: translateY(-3px); box-shadow: 0 14px 30px -14px rgba(0,0,0,.22); }
.tn-card:active { transform: translateY(-1px) scale(.995); }
.tn-btn { position: relative; overflow: hidden; transition: transform .15s ease, filter .2s ease, background-color .2s ease; }
.tn-btn:hover { filter: brightness(1.06); }
.tn-btn:active { transform: scale(.94); }
.tn-btn::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: radial-gradient(circle at var(--rx,50%) var(--ry,50%), rgba(255,255,255,.4) 0%, transparent 50%);
  opacity: 0; transition: opacity .45s ease;
}
.tn-btn:active::after { opacity: 1; transition: opacity .05s; }
button:focus-visible, a:focus-visible { outline: 2px solid rgb(99 102 241 / .6); outline-offset: 2px; border-radius: 12px; }
.material-symbols-outlined { transition: transform .2s ease; }
.tn-btn:hover .material-symbols-outlined { transform: scale(1.1); }
iframe[title="India Map"] { transition: filter .35s ease, transform .5s ease; }
.group:hover iframe[title="India Map"] { filter: saturate(1.15) contrast(1.05); transform: scale(1.02); }
.tn-rise:nth-child(2){animation-delay:.05s}.tn-rise:nth-child(3){animation-delay:.1s}.tn-rise:nth-child(4){animation-delay:.15s}.tn-rise:nth-child(5){animation-delay:.2s}.tn-rise:nth-child(6){animation-delay:.25s}

/* === Responsive shell: phone-first, centered on tablet/desktop === */
@media (min-width: 768px) {
  /* Ambient backdrop behind the centered app shell */
  body { background:
    radial-gradient(1200px 600px at 20% -10%, rgba(99,102,241,.10), transparent 60%),
    radial-gradient(1000px 500px at 110% 10%, rgba(16,185,129,.10), transparent 60%),
    #f1f5f9;
  }
  /* Widen any mobile-locked container */
  .max-w-md { max-width: 32rem !important; }
  /* Pin bottom navs to the centered shell width */
  nav.fixed.bottom-0.w-full,
  nav.fixed.bottom-0 {
    left: 50% !important;
    transform: translateX(-50%) !important;
    width: 100% !important;
    max-width: 32rem !important;
    border-radius: 1.25rem 1.25rem 0 0;
    box-shadow: 0 -10px 40px -20px rgba(0,0,0,.25);
  }
  /* Floating absolute CTAs inside the shell */
  .absolute.bottom-24.w-full, .absolute.bottom-20.w-full { max-width: 32rem; }
}
@media (min-width: 1024px) {
  .max-w-md { max-width: 36rem !important; }
  nav.fixed.bottom-0.w-full, nav.fixed.bottom-0 { max-width: 36rem !important; }
}

/* Phone shell safety: never let pages overflow horizontally */
html, body { overflow-x: hidden; }
img, iframe, video { max-width: 100%; }

/* Smaller tap targets on tiny phones */
@media (max-width: 360px) {
  .px-margin-mobile { padding-left: 12px; padding-right: 12px; }
  .text-headline-md, .font-headline-md { font-size: 1.25rem; line-height: 1.7rem; }
}
</style>
`;

export function personalize(html, fullName, email) {
  const first = (fullName || "").trim().split(/\s+/)[0] || "Friend";
  const initial = first.charAt(0).toUpperCase();
  const greeting = timeGreeting();

  let out = indianize(html);
  out = out.replace(/Priya Sharma/g, fullName || first);
  out = out.replace(/Elena Rodriguez/g, fullName || first);
  out = out.replace(/\bPriya\s+S\./g, `${first} ${initial}.`);
  out = out.replace(/\bElena\s+R\./g, `${first} ${initial}.`);
  out = out.replace(/\bPriya\b/g, first);
  out = out.replace(/\bElena\b/g, first);
  out = out.replace(/Good\s+(Morning|Afternoon|Evening),\s*[A-Za-z]+/g, `${greeting}, ${first}`);
  if (email) {
    out = out.replace(/[a-z0-9._%+-]+@example\.(com|org)/gi, email);
    out = out.replace(/priya\.sharma@[^\s"'<]+/gi, email);
    out = out.replace(/elena\.rodriguez@[^\s"'<]+/gi, email);
  }
  out = addInteractivity(out);
  return INTERACTIVE_CSS + out;
}

export function HtmlPage({ html, className }) {
  const { user } = useAuth();
  const router = useRouter();
  const containerRef = useRef(null);

  const name = user?.name || "Friend";
  const email = user?.email || "";
  const finalHtml = personalize(html, name, email);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Intercept dummy links and route them via TanStack Router
    const handleClick = (e) => {
      const a = e.target.closest('a');
      if (!a || a.getAttribute('href') !== '#') return;
      
      const text = a.textContent.trim().toLowerCase();
      const map = {
        'home': '/',
        'heatmap': '/heatmap',
        'circle': '/circle',
        'guardian': '/guardian',
        'profile': '/profile',
        'emergency settings': '/settings',
        'safety history': '/history',
        'privacy guard': '/privacy',
        'support': '/support'
      };
      
      for (const [key, path] of Object.entries(map)) {
        if (text.includes(key)) {
          e.preventDefault();
          router.navigate({ to: path });
          return;
        }
      }
    };

    // 2. Interactive toggle switches
    const handleToggle = (e) => {
      const switchBtn = e.target.closest('button[role="switch"]');
      if (!switchBtn) return;
      
      const isChecked = switchBtn.getAttribute('aria-checked') === 'true';
      const span = switchBtn.querySelector('span');
      
      if (isChecked) {
        // Toggle OFF
        switchBtn.setAttribute('aria-checked', 'false');
        switchBtn.className = "w-11 h-6 rounded-full relative transition bg-gray-300 dark:bg-surface-variant";
        if (span) span.className = "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition";
      } else {
        // Toggle ON
        switchBtn.setAttribute('aria-checked', 'true');
        switchBtn.className = "w-11 h-6 rounded-full relative transition bg-primary text-white";
        if (span) span.className = "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition translate-x-5";
      }
    };

    // 3. Ripple effect for buttons
    const handlePointerDown = (e) => {
      const t = e.target.closest && e.target.closest('.tn-btn');
      if (!t) return;
      const r = t.getBoundingClientRect();
      t.style.setProperty('--rx', ((e.clientX - r.left) / r.width * 100) + '%');
      t.style.setProperty('--ry', ((e.clientY - r.top) / r.height * 100) + '%');
    };

    container.addEventListener('click', handleClick);
    container.addEventListener('click', handleToggle);
    document.addEventListener('pointerdown', handlePointerDown, true);

    return () => {
      container.removeEventListener('click', handleClick);
      container.removeEventListener('click', handleToggle);
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [router]);

  return (
    <div
      ref={containerRef}
      className={
        className ??
        "bg-surface text-on-surface font-body-md min-h-screen flex flex-col antialiased"
      }
      dangerouslySetInnerHTML={{ __html: finalHtml }}
    />
  );
}
