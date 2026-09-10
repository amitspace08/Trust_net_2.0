import { db } from "../firebase/firebase";
import { collection, addDoc, serverTimestamp, setDoc, doc } from "firebase/firestore";
import { getGridCell } from "./safetyRatingService";

// Safe spaces to seed in Jaipur
const JAIPUR_SAFE_SPACES = [
  {
    name: "Jaipur Police Station (Kotwali)",
    type: "police_station",
    latitude: 26.9238,
    longitude: 75.8236,
    address: "Kotwali, Jaipur, Rajasthan",
  },
  {
    name: "Apollo Pharmacy 24x7",
    type: "pharmacy",
    latitude: 26.9124,
    longitude: 75.7873,
    address: "C-Scheme, Jaipur, Rajasthan",
  },
  {
    name: "HP Petrol Pump",
    type: "petrol_station",
    latitude: 26.9168,
    longitude: 75.7995,
    address: "MI Road, Jaipur, Rajasthan",
  },
  {
    name: "MGF Metropolitan Mall",
    type: "public_building",
    latitude: 26.9075,
    longitude: 75.7912,
    address: "Bais Godam, Jaipur, Rajasthan",
  },
  {
    name: "SMS Hospital Pharmacy",
    type: "pharmacy",
    latitude: 26.8994,
    longitude: 75.8152,
    address: "SMS Hospital, Jaipur, Rajasthan",
  },
  {
    name: "Jaipur Central Mall",
    type: "public_building",
    latitude: 26.8924,
    longitude: 75.8061,
    address: "Tonk Road, Jaipur, Rajasthan",
  },
  {
    name: "Vidhan Sabha Police Outpost",
    type: "police_station",
    latitude: 26.8974,
    longitude: 75.7952,
    address: "Jyoti Nagar, Jaipur, Rajasthan",
  },
  {
    name: "Fortis Emergency Pharmacy",
    type: "pharmacy",
    latitude: 26.8488,
    longitude: 75.8035,
    address: "Malviya Nagar, Jaipur, Rajasthan",
  },
  {
    name: "Indian Oil Petrol Station",
    type: "petrol_station",
    latitude: 26.8524,
    longitude: 75.8112,
    address: "JLN Marg, Jaipur, Rajasthan",
  },
  {
    name: "World Trade Park Mall",
    type: "public_building",
    latitude: 26.8532,
    longitude: 75.8048,
    address: "Malviya Nagar, Jaipur, Rajasthan",
  },
  {
    name: "Vaishali Nagar Police Station",
    type: "police_station",
    latitude: 26.9038,
    longitude: 75.7368,
    address: "Vaishali Nagar, Jaipur, Rajasthan",
  },
  {
    name: "MedPlus Vaishali Nagar",
    type: "pharmacy",
    latitude: 26.9012,
    longitude: 75.7425,
    address: "Amrapali Marg, Jaipur, Rajasthan",
  },
  {
    name: "Shell Petrol Station Vaishali",
    type: "petrol_station",
    latitude: 26.8984,
    longitude: 75.7312,
    address: "Queens Road, Jaipur, Rajasthan",
  },
  {
    name: "Raja Park Police Station",
    type: "police_station",
    latitude: 26.8955,
    longitude: 75.8368,
    address: "Raja Park, Jaipur, Rajasthan",
  },
  {
    name: "24/7 Chemist Raja Park",
    type: "pharmacy",
    latitude: 26.8962,
    longitude: 75.8295,
    address: "Raja Park, Jaipur, Rajasthan",
  },
];

// Safe spaces to seed in Delhi (fallback)
const DELHI_SAFE_SPACES = [
  {
    name: "Connaught Place Police Station",
    type: "police_station",
    latitude: 28.6292,
    longitude: 77.2185,
    address: "Connaught Place, New Delhi",
  },
  {
    name: "Apollo Pharmacy Connaught Place",
    type: "pharmacy",
    latitude: 28.6304,
    longitude: 77.2177,
    address: "Radial Road 4, Connaught Place, New Delhi",
  },
  {
    name: "Bharat Petroleum CP",
    type: "petrol_station",
    latitude: 28.6268,
    longitude: 77.2095,
    address: "Baba Kharak Singh Marg, New Delhi",
  },
  {
    name: "Palika Bazaar Safe Outpost",
    type: "public_building",
    latitude: 28.6301,
    longitude: 77.2198,
    address: "Palika Bazaar, New Delhi",
  },
  {
    name: "Max Hospital Emergency Pharmacy",
    type: "pharmacy",
    latitude: 28.6185,
    longitude: 77.2024,
    address: "Panchsheel Marg, New Delhi",
  },
];

// Mock Guardian Angels to seed
const GUARDIAN_ANGELS = [
  {
    uid: "ga_jaipur_1",
    name: "Rakesh Kumar",
    phone: "+91 98765 43210",
    latitude: 26.9135,
    longitude: 75.7895,
  },
  {
    uid: "ga_jaipur_2",
    name: "Sunita Sharma",
    phone: "+91 98765 43211",
    latitude: 26.9095,
    longitude: 75.7825,
  },
  {
    uid: "ga_jaipur_3",
    name: "Vikram Singh",
    phone: "+91 98765 43212",
    latitude: 26.9165,
    longitude: 75.7915,
  },
  {
    uid: "ga_jaipur_4",
    name: "Pooja Gupta",
    phone: "+91 98765 43213",
    latitude: 26.9015,
    longitude: 75.8015,
  },
  {
    uid: "ga_jaipur_5",
    name: "Anil Verma",
    phone: "+91 98765 43214",
    latitude: 26.8955,
    longitude: 75.8195,
  },
  // Delhi GAs
  {
    uid: "ga_delhi_1",
    name: "Amit Sharma",
    phone: "+91 99999 11111",
    latitude: 28.6145,
    longitude: 77.2075,
  },
  {
    uid: "ga_delhi_2",
    name: "Neha Saxena",
    phone: "+91 99999 22222",
    latitude: 28.6125,
    longitude: 77.2115,
  },
  {
    uid: "ga_delhi_3",
    name: "Suresh Gupta",
    phone: "+91 99999 33333",
    latitude: 28.6185,
    longitude: 77.2045,
  },
];

// Seeding function
export const seedDatabase = async () => {
  console.log("Seeding started...");

  // 1. Seed Safe Spaces
  for (const space of [...JAIPUR_SAFE_SPACES, ...DELHI_SAFE_SPACES]) {
    await addDoc(collection(db, "safe_spaces"), {
      ...space,
      verified: true,
      registeredAt: serverTimestamp(),
    });
  }
  console.log("Safe Spaces seeded.");

  // 2. Seed Guardian Angels
  for (const ga of GUARDIAN_ANGELS) {
    // Write user info
    await setDoc(doc(db, "users", ga.uid), {
      uid: ga.uid,
      name: ga.name,
      phone: ga.phone,
      isGuardianAngel: true,
      guardianVerified: true,
      guardianAvailable: true,
      guardianRating: 4.8,
      guardianResponseCount: 12,
      guardianRegisteredAt: serverTimestamp(),
    });

    // Write location
    await setDoc(doc(db, "user_locations", ga.uid), {
      uid: ga.uid,
      latitude: ga.latitude,
      longitude: ga.longitude,
      sharingEnabled: true,
      timestamp: serverTimestamp(),
    });
  }
  console.log("Guardian Angels seeded.");

  // 3. Seed Safety Ratings (80 around Jaipur, 20 around Delhi)
  const tagsPool = ["Poor lighting", "Isolated", "Well lit", "Crowded", "Police presence"];

  // Seed Jaipur ratings
  for (let i = 0; i < 80; i++) {
    // Generate lat/lng close to Jaipur center (within 5km)
    const latOffset = (Math.random() - 0.5) * 0.09;
    const lngOffset = (Math.random() - 0.5) * 0.09;
    const lat = 26.9124 + latOffset;
    const lng = 75.7873 + lngOffset;
    const score = Math.floor(Math.random() * 10) + 1; // 1 to 10

    // Select 1 to 2 random tags
    const tags = [
      tagsPool[Math.floor(Math.random() * tagsPool.length)],
      tagsPool[Math.floor(Math.random() * tagsPool.length)],
    ];

    // Deduplicate
    const uniqueTags = Array.from(new Set(tags));
    const gridCell = getGridCell(lat, lng);

    await addDoc(collection(db, "safety_ratings"), {
      uid: `seed_user_j_${i}`,
      latitude: lat,
      longitude: lng,
      score,
      tags: uniqueTags,
      gridCell,
      timestamp: serverTimestamp(),
    });
  }

  // Seed Delhi ratings
  for (let i = 0; i < 20; i++) {
    const latOffset = (Math.random() - 0.5) * 0.05;
    const lngOffset = (Math.random() - 0.5) * 0.05;
    const lat = 28.6139 + latOffset;
    const lng = 77.209 + lngOffset;
    const score = Math.floor(Math.random() * 10) + 1;

    const tags = [
      tagsPool[Math.floor(Math.random() * tagsPool.length)],
      tagsPool[Math.floor(Math.random() * tagsPool.length)],
    ];

    const uniqueTags = Array.from(new Set(tags));
    const gridCell = getGridCell(lat, lng);

    await addDoc(collection(db, "safety_ratings"), {
      uid: `seed_user_d_${i}`,
      latitude: lat,
      longitude: lng,
      score,
      tags: uniqueTags,
      gridCell,
      timestamp: serverTimestamp(),
    });
  }

  console.log("Safety Ratings seeded.");
  console.log("Seeding finished successfully!");
};
