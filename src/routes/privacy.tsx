import { createFileRoute } from "@tanstack/react-router";
import { HtmlPage } from "../lib/html-page";
import { useAuth } from "../lib/auth";

const HTML = `
<!-- TopAppBar (Mobile Only) / Header (Web) -->
<header class="bg-surface dark:bg-background text-primary dark:text-primary-fixed w-full top-0 sticky bg-surface-container dark:bg-surface-dim flat no shadows flex justify-between items-center px-margin-mobile h-16 z-40 md:hidden">
  <div class="flex items-center gap-4">
    <button class="hover:bg-surface-container-highest dark:hover:bg-surface-variant transition-colors active:scale-95 duration-100 p-2 rounded-full flex items-center justify-center text-on-surface-variant dark:text-on-surface-variant">
      <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">shield_with_heart</span>
    </button>
    <h1 class="font-title-lg text-title-lg font-bold">TrustNet</h1>
  </div>
  <button class="hover:bg-surface-container-highest dark:hover:bg-surface-variant transition-colors active:scale-95 duration-100 p-2 rounded-full flex items-center justify-center text-on-surface-variant dark:text-on-surface-variant">
    <span class="material-symbols-outlined">notifications</span>
  </button>
</header>

<!-- NavigationDrawer (Web Only) -->
<nav class="hidden md:flex flex-col bg-surface dark:bg-surface-dim text-primary dark:text-primary-fixed h-full rounded-r-xl shadow-lg dark:shadow-none transition-all duration-200 ease-in-out w-72 max-w-[80vw] p-4 fixed left-0 top-0 z-50">
  <div class="flex items-center gap-4 mb-8 pt-4">
    <img alt="User Profile" class="w-12 h-12 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBx1s7cKAePJFBmHojTu4cZFC5UuKj7jy18bCo1PM4SW_Vq5HYCCIWn0KyQnEhANOITgjZ26GcVwUeRHxoReatAnGazD1zxMKBI_VAR8nw3wmyMACxViNWxxjWKsY65vV9JapMbu3sUJ8E_GtOE9bhZVbsq_BDxFZWuatWbgXcZTrsz4dLzZ3Y_CsHGbVN-qt2bFi2MogcVI7L3uTSjiqjH2qo_WG1uJvJ8opyJqJ1uc15T-26Wlw-qNL4n_tMsUpUtWgG0AQUkufcK">
    <div>
      <h2 class="font-title-lg text-title-lg text-primary">User Name</h2>
      <p class="font-label-md text-label-md text-on-surface-variant">Safety Status: Protected</p>
      <p class="font-label-md text-label-md text-on-surface-variant">Trust Score: 98</p>
    </div>
  </div>
  <ul class="flex flex-col gap-2">
    <li><a class="flex items-center gap-3 px-4 py-3 rounded-full text-on-surface-variant dark:text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-variant transition-all font-label-lg text-label-lg" href="#"><span class="material-symbols-outlined">settings_ethernet</span>Emergency Settings</a></li>
    <li><a class="flex items-center gap-3 px-4 py-3 rounded-full text-on-surface-variant dark:text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-variant transition-all font-label-lg text-label-lg" href="#"><span class="material-symbols-outlined">history</span>Safety History</a></li>
    <li><a class="flex items-center gap-3 px-4 py-3 rounded-full bg-secondary-container dark:bg-secondary text-on-secondary-container dark:text-on-secondary font-bold font-label-lg text-label-lg" href="#"><span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">privacy_tip</span>Privacy Guard</a></li>
    <li><a class="flex items-center gap-3 px-4 py-3 rounded-full text-on-surface-variant dark:text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-variant transition-all font-label-lg text-label-lg" href="#"><span class="material-symbols-outlined">help</span>Support</a></li>
  </ul>
  <div class="mt-auto">
    <ul class="flex flex-col gap-2">
      <li><a class="flex items-center gap-3 px-4 py-3 rounded-full text-on-surface-variant dark:text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-variant transition-all font-label-lg text-label-lg" href="#"><span class="material-symbols-outlined">home</span>Home</a></li>
      <li><a class="flex items-center gap-3 px-4 py-3 rounded-full text-on-surface-variant dark:text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-variant transition-all font-label-lg text-label-lg" href="#"><span class="material-symbols-outlined">map</span>Heatmap</a></li>
      <li><a class="flex items-center gap-3 px-4 py-3 rounded-full text-on-surface-variant dark:text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-variant transition-all font-label-lg text-label-lg" href="#"><span class="material-symbols-outlined">group</span>Circle</a></li>
      <li><a class="flex items-center gap-3 px-4 py-3 rounded-full text-on-surface-variant dark:text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-variant transition-all font-label-lg text-label-lg" href="#"><span class="material-symbols-outlined">security</span>Guardian</a></li>
      <li><a class="flex items-center gap-3 px-4 py-3 rounded-full text-on-surface-variant dark:text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-variant transition-all font-label-lg text-label-lg" href="#"><span class="material-symbols-outlined">person</span>Profile</a></li>
    </ul>
  </div>
</nav>

<!-- Main Canvas -->
<main class="flex-grow w-full max-w-4xl mx-auto px-margin-mobile md:px-margin-tablet py-6 md:ml-72 pb-32 md:pb-6 flex flex-col gap-stack-gap">
  <!-- Header -->
  <div class="mb-stack-gap">
    <h1 class="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-background mb-2">Privacy Guard</h1>
    <p class="font-body-md text-body-md text-on-surface-variant">Control who sees your live location, manage contacts data permissions, and adjust emergency metadata storage.</p>
  </div>

  <!-- Bento Alert Explainer -->
  <section class="bg-primary-container/20 border border-primary/20 rounded-xl p-4 flex gap-3 items-start">
    <span class="material-symbols-outlined text-primary mt-0.5" style="font-variation-settings: 'FILL' 1;">privacy_tip</span>
    <div>
      <h3 class="font-title-md text-title-md text-on-primary-container mb-1">Your Privacy is Protected</h3>
      <p class="font-body-md text-body-md text-on-primary-container/80 text-sm">TrustNet uses end-to-end encryption for active tracking logs. Your coordinates are never sold or stored beyond emergency dispatch time windows.</p>
    </div>
  </section>

  <!-- Toggle List -->
  <section class="bg-surface-container-low rounded-xl border border-outline-variant/30 divide-y divide-outline-variant/20">
    <!-- Row 1 -->
    <div class="flex items-start justify-between gap-4 p-4">
      <div class="flex-1 min-w-0">
        <p class="font-title-md text-title-md text-on-surface">Emergency Live Sharing</p>
        <p class="font-body-md text-body-md text-on-surface-variant text-sm mt-0.5">Automatically broadcast GPS coordinates to Layer 1 contacts when SOS is active.</p>
      </div>
      <button role="switch" aria-checked="true" class="w-11 h-6 rounded-full relative transition bg-primary">
        <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition translate-x-5"></span>
      </button>
    </div>

    <!-- Row 2 -->
    <div class="flex items-start justify-between gap-4 p-4">
      <div class="flex-1 min-w-0">
        <p class="font-title-md text-title-md text-on-surface">Background Location Access</p>
        <p class="font-body-md text-body-md text-on-surface-variant text-sm mt-0.5">Let TrustNet watch safety levels when the app runs in background during walks.</p>
      </div>
      <button role="switch" aria-checked="true" class="w-11 h-6 rounded-full relative transition bg-primary">
        <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition translate-x-5"></span>
      </button>
    </div>

    <!-- Row 3 -->
    <div class="flex items-start justify-between gap-4 p-4">
      <div class="flex-1 min-w-0">
        <p class="font-title-md text-title-md text-on-surface">Auto-Record Emergency Audio</p>
        <p class="font-body-md text-body-md text-on-surface-variant text-sm mt-0.5">Enable mic recording automatically during SOS. Uploaded securely for your guardians.</p>
      </div>
      <button role="switch" aria-checked="false" class="w-11 h-6 rounded-full relative transition bg-gray-300 dark:bg-surface-variant">
        <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition"></span>
      </button>
    </div>

    <!-- Row 4 -->
    <div class="flex items-start justify-between gap-4 p-4">
      <div class="flex-1 min-w-0">
        <p class="font-title-md text-title-md text-on-surface">Layer 2 Discoverability</p>
        <p class="font-body-md text-body-md text-on-surface-variant text-sm mt-0.5">Allow friends of friends (Layer 2) to search for your safety score and mutual contacts.</p>
      </div>
      <button role="switch" aria-checked="true" class="w-11 h-6 rounded-full relative transition bg-primary">
        <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition translate-x-5"></span>
      </button>
    </div>

    <!-- Row 5 -->
    <div class="flex items-start justify-between gap-4 p-4">
      <div class="flex-1 min-w-0">
        <p class="font-title-md text-title-md text-on-surface">Data Retention Limit (7 days)</p>
        <p class="font-body-md text-body-md text-on-surface-variant text-sm mt-0.5">Automatically wipe location and event histories from cloud storage after 7 days.</p>
      </div>
      <button role="switch" aria-checked="false" class="w-11 h-6 rounded-full relative transition bg-gray-300 dark:bg-surface-variant">
        <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition"></span>
      </button>
    </div>
  </section>
</main>

<!-- BottomNavBar (Mobile Only) -->
<nav class="bg-surface-container-lowest dark:bg-surface-container-low text-primary dark:text-primary-fixed-dim font-label-md text-label-md fixed bottom-0 w-full z-50 rounded-t-xl shadow-sm dark:shadow-none flex justify-around items-center h-20 px-2 pb-safe md:hidden border-t border-surface-container-highest">
  <a class="flex flex-col items-center justify-center text-on-surface-variant dark:text-on-surface-variant px-3 py-1 hover:bg-surface-container-high dark:hover:bg-surface-variant active:scale-90 transition-transform" href="#">
    <span class="material-symbols-outlined">home</span>
    <span class="mt-1">Home</span>
  </a>
  <a class="flex flex-col items-center justify-center text-on-surface-variant dark:text-on-surface-variant px-3 py-1 hover:bg-surface-container-high dark:hover:bg-surface-variant active:scale-90 transition-transform" href="#">
    <span class="material-symbols-outlined">map</span>
    <span class="mt-1">Heatmap</span>
  </a>
  <a class="flex flex-col items-center justify-center text-on-surface-variant dark:text-on-surface-variant px-3 py-1 hover:bg-surface-container-high dark:hover:bg-surface-variant active:scale-90 transition-transform" href="#">
    <span class="material-symbols-outlined">group</span>
    <span class="mt-1">Circle</span>
  </a>
  <a class="flex flex-col items-center justify-center text-on-surface-variant dark:text-on-surface-variant px-3 py-1 hover:bg-surface-container-high dark:hover:bg-surface-variant active:scale-90 transition-transform" href="#">
    <span class="material-symbols-outlined">security</span>
    <span class="mt-1">Guardian</span>
  </a>
  <a class="flex flex-col items-center justify-center text-on-surface-variant dark:text-on-surface-variant px-3 py-1 hover:bg-surface-container-high dark:hover:bg-surface-variant active:scale-90 transition-transform" href="#">
    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">person</span>
    <span class="mt-1">Profile</span>
  </a>
</nav>
`;

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [{ title: "TrustNet - Privacy Guard" }],
  }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const avatarUrl = user?.avatar || user?.profile_photo || "";
  const userName = user?.name || "User";

  const isPlaceholder = !avatarUrl || avatarUrl.includes("aida-public") || avatarUrl.includes("dicebear");
  const initial = (userName || "U").trim().charAt(0).toUpperCase();
  const bgClasses = ["bg-blue-600", "bg-emerald-600", "bg-indigo-600", "bg-purple-600", "bg-rose-600", "bg-amber-600", "bg-teal-600", "bg-cyan-600"];
  const charCode = userName.trim().charCodeAt(0) || 0;
  const bgColor = bgClasses[charCode % bgClasses.length];

  const avatarHTML = isPlaceholder
    ? `<div class="w-12 h-12 rounded-full flex items-center justify-center font-bold uppercase text-white ${bgColor} border border-white/10 shrink-0 select-none text-base">${initial}</div>`
    : `<img alt="User Profile" class="w-12 h-12 rounded-full object-cover border border-gray-100" src="${avatarUrl}">`;

  const dynamicHTML = HTML
    .replace(
      '<img alt="User Profile" class="w-12 h-12 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBx1s7cKAePJFBmHojTu4cZFC5UuKj7jy18bCo1PM4SW_Vq5HYCCIWn0KyQnEhANOITgjZ26GcVwUeRHxoReatAnGazD1zxMKBI_VAR8nw3wmyMACxViNWxxjWKsY65vV9JapMbu3sUJ8E_GtOE9bhZVbsq_BDxFZWuatWbgXcZTrsz4dLzZ3Y_CsHGbVN-qt2bFi2MogcVI7L3uTSjiqjH2qo_WG1uJvJ8opyJqJ1uc15T-26Wlw-qNL4n_tMsUpUtWgG0AQUkufcK">',
      avatarHTML
    )
    .replaceAll(
      'User Name',
      userName
    );

  return (
    <HtmlPage
      html={dynamicHTML}
      className="bg-background text-on-background min-h-screen flex flex-col font-body-md antialiased md:flex-row overflow-x-hidden pb-20 md:pb-0"
    />
  );
}
