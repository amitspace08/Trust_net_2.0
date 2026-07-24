/**
 * TrustNet — Safety Rating E2E Test Script
 * Run with:  node scripts/testSafetyRatings.mjs
 *
 * Tests:
 *  1. Submit a rating → immediately call getAreaScore → confirm score appears.
 *  2. Submit 3 more ratings from the same user in the same 2-hour window →
 *     confirm the 2-hour cooldown error fires on the 2nd attempt.
 *  3. Confirm the 24-hour cap of 3 ratings per gridCell is enforced.
 *
 * Uses firebase-admin (bypasses security rules).
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
      "   Set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccount.json at root.\n"
  );
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

// ── inline copies of service functions (no TS bundler needed) ─────────────────
const getGridCell = (lat, lng) => `${lat.toFixed(3)},${lng.toFixed(3)}`;

/** Haversine distance in metres */
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function submitRatingAdmin(uid, lat, lng, score, tags) {
  const { collection, addDoc, getDocs, query, where } = await import(
    "firebase-admin/firestore"
  );

  if (score < 1 || score > 10) throw new Error("Score must be 1–10");

  const gridCell = getGridCell(lat, lng);
  const now = new Date();

  // Fetch all docs for this user+cell
  const snap = await db
    .collection("safety_ratings")
    .where("uid", "==", uid)
    .where("gridCell", "==", gridCell)
    .get();

  // 2-hour cooldown check
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  for (const doc of snap.docs) {
    const t = doc.data().timestamp;
    if (t && t.toDate() > twoHoursAgo) {
      throw new Error(
        "You can only submit one rating for this area every 2 hours."
      );
    }
  }

  // 24-hour cap of 3
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let dailyCount = 0;
  for (const doc of snap.docs) {
    const t = doc.data().timestamp;
    if (t && t.toDate() > twentyFourHoursAgo) dailyCount++;
  }
  if (dailyCount >= 3) {
    throw new Error(
      "You have reached the limit of 3 ratings per 24 hours for this area."
    );
  }

  const ref = db.collection("safety_ratings").doc();
  await ref.set({
    uid,
    latitude: lat,
    longitude: lng,
    score,
    tags,
    gridCell,
    timestamp: Timestamp.now(),
    testDoc: true,
  });
  return ref.id;
}

async function getAreaScoreAdmin(lat, lng) {
  const snap = await db.collection("safety_ratings").get();
  let total = 0;
  let count = 0;
  const tagCounts = {};

  snap.forEach((doc) => {
    const d = doc.data();
    const dist = getDistance(lat, lng, d.latitude, d.longitude);
    if (dist <= 150) {
      total += d.score;
      count++;
      (d.tags || []).forEach((t) => {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    }
  });

  if (count < 3) return null;
  const avg = Number((total / count).toFixed(1));
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .slice(0, 2);
  return { score: avg, ratingCount: count, topTags };
}

// ── Clean up old test docs ────────────────────────────────────────────────────
async function cleanupTestDocs() {
  const snap = await db
    .collection("safety_ratings")
    .where("testDoc", "==", true)
    .get();
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  console.log(`   Cleaned ${snap.size} leftover test docs.\n`);
}

// ── Test coordinates (Vaishali Nagar — already has seed data) ────────────────
const TEST_LAT = 26.9219;
const TEST_LNG = 75.7372;
const TEST_UID = "e2e_test_user";

// ── Main ──────────────────────────────────────────────────────────────────────
const runTests = async () => {
  console.log("\n====================================================");
  console.log("TRUSTNET SAFETY RATING E2E TESTS");
  console.log("====================================================\n");

  await cleanupTestDocs();

  let passed = 0;
  let failed = 0;

  // ------------------------------------------------------------------
  // TEST 1: Submit rating → getAreaScore updates
  // ------------------------------------------------------------------
  console.log("Test 1: Submit rating → getAreaScore reflects new data...");
  try {
    const scoreBefore = await getAreaScoreAdmin(TEST_LAT, TEST_LNG);
    const countBefore = scoreBefore?.ratingCount ?? 0;

    await submitRatingAdmin(TEST_UID, TEST_LAT, TEST_LNG, 8, ["Well lit"]);

    const scoreAfter = await getAreaScoreAdmin(TEST_LAT, TEST_LNG);
    const countAfter = scoreAfter?.ratingCount ?? 0;

    if (countAfter > countBefore && scoreAfter !== null) {
      console.log(`  [PASS] ratingCount went ${countBefore} → ${countAfter}, score = ${scoreAfter.score}`);
      passed++;
    } else {
      console.log(`  [FAIL] ratingCount did not increase (before=${countBefore}, after=${countAfter})`);
      failed++;
    }
  } catch (err) {
    console.log(`  [FAIL] Unexpected error: ${err.message}`);
    failed++;
  }

  // ------------------------------------------------------------------
  // TEST 2: 2-hour cooldown fires on 2nd same-area submission
  // ------------------------------------------------------------------
  console.log("\nTest 2: 2-hour cooldown blocks a second rating within 2 hours...");
  try {
    await submitRatingAdmin(TEST_UID, TEST_LAT + 0.0001, TEST_LNG + 0.0001, 7, ["Crowded"]);
    console.log("  [FAIL] Expected cooldown error but submission succeeded.");
    failed++;
  } catch (err) {
    if (err.message.includes("2 hours")) {
      console.log(`  [PASS] Cooldown enforced: "${err.message}"`);
      passed++;
    } else {
      console.log(`  [FAIL] Wrong error: ${err.message}`);
      failed++;
    }
  }

  // ------------------------------------------------------------------
  // TEST 3: 24-hour cap of 3 ratings enforced
  //  We'll seed 2 back-dated docs (>2h ago but <24h) then try a 4th.
  // ------------------------------------------------------------------
  console.log("\nTest 3: 24-hour cap of 3 ratings per gridCell enforced...");
  try {
    // Seed 2 extra docs older than 2h so they pass cooldown but count toward 24h cap
    const gridCell = getGridCell(TEST_LAT, TEST_LNG);
    const threeHoursAgo = Timestamp.fromDate(new Date(Date.now() - 3 * 60 * 60 * 1000));

    const batch = db.batch();
    for (let i = 0; i < 2; i++) {
      const ref = db.collection("safety_ratings").doc();
      batch.set(ref, {
        uid: TEST_UID,
        latitude: TEST_LAT,
        longitude: TEST_LNG,
        score: 5,
        tags: [],
        gridCell,
        timestamp: threeHoursAgo,
        testDoc: true,
      });
    }
    await batch.commit();

    // Now try to submit a 4th — this should hit the 24h cap
    await submitRatingAdmin(TEST_UID, TEST_LAT, TEST_LNG, 6, ["Isolated"]);
    console.log("  [FAIL] Expected 24h cap error but submission succeeded.");
    failed++;
  } catch (err) {
    if (err.message.includes("24 hours")) {
      console.log(`  [PASS] 24h cap enforced: "${err.message}"`);
      passed++;
    } else {
      console.log(`  [FAIL] Wrong error: ${err.message}`);
      failed++;
    }
  }

  // ------------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------------
  await cleanupTestDocs();

  console.log("\n====================================================");
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log("ALL SAFETY RATING E2E TESTS PASSED ✅");
  } else {
    console.log("SOME TESTS FAILED ❌");
    process.exitCode = 1;
  }
  console.log("====================================================\n");
};

runTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
