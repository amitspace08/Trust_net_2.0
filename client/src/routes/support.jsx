import { createFileRoute } from "@tanstack/react-router";
import { HtmlPage } from "../lib/html-page";
import { useAuth } from "../lib/auth";

const HTML = `
<!-- Main Canvas -->

<!-- Main Canvas -->
<main class="flex-grow w-full max-w-4xl mx-auto px-margin-mobile md:px-margin-tablet py-6 md:ml-72 pb-32 md:pb-6 flex flex-col gap-stack-gap">
  <!-- Header -->
  <div class="mb-stack-gap">
    <h1 class="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-background mb-2">Help & Support</h1>
    <p class="font-body-md text-body-md text-on-surface-variant">Access emergency helplines, review safety walkthroughs, or get in touch with local support teams.</p>
  </div>

  <!-- Helpline Quick Trigger (Asymmetrical Bento) -->
  <section class="grid grid-cols-1 md:grid-cols-2 gap-component-gap">
    <div class="bg-error-container text-on-error-container rounded-xl p-5 shadow-sm flex flex-col justify-between h-40">
      <div>
        <h3 class="font-title-lg text-title-lg flex items-center gap-2">
          <span class="material-symbols-outlined">local_police</span> Emergency Services
        </h3>
        <p class="font-body-md text-body-md opacity-85 text-sm mt-1">Directly call national police and dispatch forces (112 / 100).</p>
      </div>
      <button class="tn-btn w-full bg-error text-on-error py-2.5 rounded-lg font-title-md text-title-md mt-4 active:scale-95 transition-transform flex items-center justify-center gap-2">
        <span class="material-symbols-outlined">call</span> Call 112 Dispatch
      </button>
    </div>

    <div class="bg-secondary-container text-on-secondary-container rounded-xl p-5 shadow-sm flex flex-col justify-between h-40">
      <div>
        <h3 class="font-title-lg text-title-lg flex items-center gap-2">
          <span class="material-symbols-outlined">emergency_share</span> TrustNet Support
        </h3>
        <p class="font-body-md text-body-md opacity-85 text-sm mt-1">Contact the TrustNet safety response desk for general account or safety assistance.</p>
      </div>
      <button class="tn-btn w-full bg-secondary text-on-secondary py-2.5 rounded-lg font-title-md text-title-md mt-4 active:scale-95 transition-transform flex items-center justify-center gap-2">
        <span class="material-symbols-outlined">chat</span> Chat with Safety Desk
      </button>
    </div>
  </section>

  <!-- Interactive FAQs (Details Summary) -->
  <section class="flex flex-col gap-3">
    <h2 class="font-title-lg text-title-lg text-on-background mb-1">Frequently Asked Questions</h2>
    
    <div class="flex flex-col gap-2">
      <!-- FAQ 1 -->
      <details class="group bg-surface-container rounded-xl p-4 border border-outline-variant/20 [&_summary::-webkit-details-marker]:hidden">
        <summary class="flex justify-between items-center font-title-md text-title-md text-on-surface cursor-pointer select-none">
          How does the SOS Hold countdown work?
          <span class="material-symbols-outlined transition-transform duration-200 group-open:rotate-180">expand_more</span>
        </summary>
        <p class="font-body-md text-body-md text-on-surface-variant mt-2 pl-1 leading-relaxed">
          The SOS button requires you to press and hold it. A red circle will fill up. Releasing it before 1.5 seconds cancels the trigger. Keeping it held down completes the countdown, immediately triggering an active alert state and notifying your safety circle.
        </p>
      </details>

      <!-- FAQ 2 -->
      <details class="group bg-surface-container rounded-xl p-4 border border-outline-variant/20 [&_summary::-webkit-details-marker]:hidden">
        <summary class="flex justify-between items-center font-title-md text-title-md text-on-surface cursor-pointer select-none">
          What is "Layer 2" inside my safety network?
          <span class="material-symbols-outlined transition-transform duration-200 group-open:rotate-180">expand_more</span>
        </summary>
        <p class="font-body-md text-body-md text-on-surface-variant mt-2 pl-1 leading-relaxed">
          Layer 1 contacts are your direct trusted friends/family. Layer 2 contacts are the trusted guardians added by your Layer 1 contacts. In an emergency, if Layer 1 cannot respond, the protocol escalates to Layer 2 guardians nearby to optimize response times.
        </p>
      </details>

      <!-- FAQ 3 -->
      <details class="group bg-surface-container rounded-xl p-4 border border-outline-variant/20 [&_summary::-webkit-details-marker]:hidden">
        <summary class="flex justify-between items-center font-title-md text-title-md text-on-surface cursor-pointer select-none">
          How is my location data handled?
          <span class="material-symbols-outlined transition-transform duration-200 group-open:rotate-180">expand_more</span>
        </summary>
        <p class="font-body-md text-body-md text-on-surface-variant mt-2 pl-1 leading-relaxed">
          TrustNet values privacy. Your location is only sent to your active circle when you start a tracked journey or complete an SOS. All history log files are end-to-end encrypted and can be automatically set to wipe after 7 days in the Privacy Guard tab.
        </p>
      </details>
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

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [{ title: "TrustNet - Help & Support" }],
  }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const avatarUrl = user?.avatar || user?.profile_photo || "";
  const userName = user?.name || "User";

  const isPlaceholder =
    !avatarUrl || avatarUrl.includes("aida-public") || avatarUrl.includes("dicebear");
  const initial = (userName || "U").trim().charAt(0).toUpperCase();
  const bgClasses = [
    "bg-blue-600",
    "bg-emerald-600",
    "bg-indigo-600",
    "bg-purple-600",
    "bg-rose-600",
    "bg-amber-600",
    "bg-teal-600",
    "bg-cyan-600",
  ];
  const charCode = userName.trim().charCodeAt(0) || 0;
  const bgColor = bgClasses[charCode % bgClasses.length];

  const avatarHTML = isPlaceholder
    ? `<div class="w-12 h-12 rounded-full flex items-center justify-center font-bold uppercase text-white ${bgColor} border border-white/10 shrink-0 select-none text-base">${initial}</div>`
    : `<img alt="User Profile" class="w-12 h-12 rounded-full object-cover border border-gray-100" src="${avatarUrl}">`;

  const dynamicHTML = HTML.replace(
    '<img alt="User Profile" class="w-12 h-12 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBx1s7cKAePJFBmHojTu4cZFC5UuKj7jy18bCo1PM4SW_Vq5HYCCIWn0KyQnEhANOITgjZ26GcVwUeRHxoReatAnGazD1zxMKBI_VAR8nw3wmyMACxViNWxxjWKsY65vV9JapMbu3sUJ8E_GtOE9bhZVbsq_BDxFZWuatWbgXcZTrsz4dLzZ3Y_CsHGbVN-qt2bFi2MogcVI7L3uTSjiqjH2qo_WG1uJvJ8opyJqJ1uc15T-26Wlw-qNL4n_tMsUpUtWgG0AQUkufcK">',
    avatarHTML,
  ).replaceAll("User Name", userName);

  return (
    <HtmlPage
      html={dynamicHTML}
      className="bg-background text-on-background min-h-screen flex flex-col font-body-md antialiased md:flex-row overflow-x-hidden pb-20 md:pb-0"
    />
  );
}
