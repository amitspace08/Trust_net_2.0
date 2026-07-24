/**
 * TrustNet — Jaipur Safety Ratings Seed Script
 * Run with:  node scripts/seedJaipurRatings.mjs
 *
 * Uses firebase-admin so it bypasses Firestore security rules.
 * Requires a serviceAccount.json at the project root, OR set:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\serviceAccount.json"
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

// ── service account ───────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SA_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(__dirname, "../serviceAccount.json");

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(SA_PATH, "utf8"));
} catch {
  console.error(
    "\n❌  Could not read Firebase service account.\n" +
      "   Place serviceAccount.json at the project root, or set\n" +
      "   GOOGLE_APPLICATION_CREDENTIALS to its path.\n"
  );
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

// ── helpers ───────────────────────────────────────────────────────────────────
const getGridCell = (lat, lng) => `${lat.toFixed(3)},${lng.toFixed(3)}`;

/** Jitter coordinate by up to ±maxMetres (1° lat ≈ 111 km) */
const jitter = (base, maxMetres) =>
  Number((base + (maxMetres / 111_000) * (Math.random() * 2 - 1)).toFixed(6));

const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Weighted score — slight bias toward the safe end of the range */
const randScore = (min, max) => {
  const raw = Math.random() * Math.random() * (max - min) + min;
  return Math.min(max, Math.max(min, Math.round(raw * 10) / 10));
};

const ALL_TAGS = [
  "Well lit",
  "Crowded",
  "Police presence",
  "Poor lighting",
  "Isolated",
  "CCTV present",
  "Busy market",
  "Safe footpath",
  "Street food area",
  "Traffic police",
];

/** 8 distinct dummy user IDs — keeps daily-cap check realistic */
const DUMMY_UIDS = [
  "seed_user_a1",
  "seed_user_b2",
  "seed_user_c3",
  "seed_user_d4",
  "seed_user_e5",
  "seed_user_f6",
  "seed_user_g7",
  "seed_user_h8",
];

// ── cluster definitions (7 Jaipur areas) ─────────────────────────────────────
const CLUSTERS = [
  {
    name: "Hawa Mahal / Pink City",
    lat: 26.9239,
    lng: 74.9347,
    jitterM: 120,
    minScore: 6,
    maxScore: 9,
    biasedTags: ["Crowded", "Well lit", "Busy market", "CCTV present"],
    count: 14,
  },
  {
    name: "MI Road / City Centre",
    lat: 26.9177,
    lng: 75.8144,
    jitterM: 100,
    minScore: 5,
    maxScore: 9,
    biasedTags: ["Traffic police", "Well lit", "Crowded", "CCTV present"],
    count: 13,
  },
  {
    name: "Jawahar Nagar",
    lat: 26.9124,
    lng: 75.7952,
    jitterM: 120,
    minScore: 4,
    maxScore: 7,
    biasedTags: ["Poor lighting", "Isolated", "Street food area"],
    count: 12,
  },
  {
    name: "Vaishali Nagar",
    lat: 26.9219,
    lng: 75.7372,
    jitterM: 130,
    minScore: 6,
    maxScore: 9,
    biasedTags: ["Safe footpath", "Well lit", "CCTV present", "Crowded"],
    count: 11,
  },
  {
    name: "Malviya Nagar",
    lat: 26.8565,
    lng: 75.8063,
    jitterM: 110,
    minScore: 5,
    maxScore: 8,
    biasedTags: ["Busy market", "Well lit", "Street food area"],
    count: 11,
  },
  {
    name: "Sanganer / Airport Area",
    lat: 26.8238,
    lng: 75.7904,
    jitterM: 140,
    minScore: 3,
    maxScore: 6,
    biasedTags: ["Isolated", "Poor lighting", "Crowded"],
    count: 10,
  },
  {
    name: "Raja Park / Tonk Road",
    lat: 26.8952,
    lng: 75.8192,
    jitterM: 100,
    minScore: 5,
    maxScore: 8,
    biasedTags: ["Well lit", "Crowded", "Police presence", "Safe footpath"],
    count: 9,
  },
];

// ── seed ──────────────────────────────────────────────────────────────────────
const seed = async () => {
  console.log("\n🌱  TrustNet — Seeding Jaipur safety ratings…\n");

  const batch = db.batch();
  let total = 0;

  for (const cluster of CLUSTERS) {
    console.log(`📍  ${cluster.name} — ${cluster.count} ratings`);

    for (let i = 0; i < cluster.count; i++) {
      const lat = jitter(cluster.lat, cluster.jitterM);
      const lng = jitter(cluster.lng, cluster.jitterM);
      const score = randScore(cluster.minScore, cluster.maxScore);

      // 1–2 tags, 70% biased toward cluster-preferred tags
      const numTags = randInt(1, 2);
      const tags = [];
      while (tags.length < numTags) {
        const t =
          Math.random() < 0.7 ? pick(cluster.biasedTags) : pick(ALL_TAGS);
        if (!tags.includes(t)) tags.push(t);
      }

      // Spread timestamps over last 30 days so cooldown checks pass
      const ageMs = Math.random() * 30 * 24 * 60 * 60 * 1000;
      const ts = Timestamp.fromDate(new Date(Date.now() - ageMs));

      const ref = db.collection("safety_ratings").doc();
      batch.set(ref, {
        uid: pick(DUMMY_UIDS),
        latitude: lat,
        longitude: lng,
        score,
        tags,
        gridCell: getGridCell(lat, lng),
        timestamp: ts,
        seeded: true,
      });

      total++;
    }
  }

  await batch.commit();

  console.log(`\n✅  Seeded ${total} ratings across ${CLUSTERS.length} Jaipur areas.\n`);
  console.log("   Navigate the map to these coordinates to see coloured badges:\n");
  for (const c of CLUSTERS) {
    const score = `${c.minScore}–${c.maxScore}`;
    console.log(
      `   ${c.name.padEnd(32)} (${c.lat}, ${c.lng})  score ${score}`
    );
  }
  console.log();
};

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
