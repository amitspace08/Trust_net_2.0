import mongoose from "mongoose";
import dotenv from "dotenv";
import SafetyRating from "../src/models/SafetyRating.js";
import connectDB from "../src/config/db.js";

dotenv.config();

const computeGridCell = (lat, lng) => {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
};

const centerLat = 28.6139;
const centerLng = 77.209;

const safetyRatings = [
  {
    uid: "user1_demo",
    location: { lat: centerLat, lng: centerLng },
    rating: 9,
    gridCell: computeGridCell(centerLat, centerLng),
    tags: ["well_lit", "police_presence"],
    comment: "Felt very safe walking here at night.",
  },
  {
    uid: "user2_demo",
    location: { lat: centerLat + 0.001, lng: centerLng + 0.001 },
    rating: 8,
    gridCell: computeGridCell(centerLat + 0.001, centerLng + 0.001),
    tags: ["well_lit", "crowded"],
    comment: "Good area, lots of people around.",
  },
  {
    uid: "user3_demo",
    location: { lat: centerLat - 0.001, lng: centerLng - 0.001 },
    rating: 10,
    gridCell: computeGridCell(centerLat - 0.001, centerLng - 0.001),
    tags: ["police_presence", "cameras"],
    comment: "Very secure with guards visible.",
  },
  {
    uid: "user4_demo",
    location: { lat: centerLat, lng: centerLng },
    rating: 7,
    gridCell: computeGridCell(centerLat, centerLng),
    tags: ["crowded"],
    comment: "Safe but a bit too chaotic.",
  },
];

const seedSafetyRatings = async () => {
  try {
    await connectDB();
    await SafetyRating.deleteMany({});
    console.log("Cleared existing safety ratings");

    await SafetyRating.insertMany(safetyRatings);
    console.log("Successfully seeded Safety Ratings");

    process.exit(0);
  } catch (error) {
    console.error("Error seeding safety ratings:", error);
    process.exit(1);
  }
};

seedSafetyRatings();
