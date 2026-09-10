import mongoose from "mongoose";
import dotenv from "dotenv";
import SafeSpace from "../src/models/SafeSpace.js";
import connectDB from "../src/config/db.js";

dotenv.config();

const safeSpaces = [
  {
    name: "Central Police Station",
    type: "police_station",
    location: { type: "Point", coordinates: [77.21, 28.614] },
    address: "Connaught Place, New Delhi",
    verified: true,
    contactPhone: "100",
    operatingHours: "24/7",
  },
  {
    name: "Apollo Pharmacy",
    type: "pharmacy",
    location: { type: "Point", coordinates: [77.208, 28.6135] },
    address: "Block A, Connaught Place",
    verified: true,
    operatingHours: "24/7",
  },
  {
    name: "Max Super Speciality Hospital",
    type: "hospital",
    location: { type: "Point", coordinates: [77.215, 28.62] },
    address: "Panchkuian Road",
    verified: true,
    contactPhone: "108",
    operatingHours: "24/7",
  },
  {
    name: "24/7 Convenience Store",
    type: "store",
    location: { type: "Point", coordinates: [77.205, 28.611] },
    address: "Janpath, New Delhi",
    verified: true,
    operatingHours: "24/7",
  },
];

const seedSafeSpaces = async () => {
  try {
    await connectDB();
    await SafeSpace.deleteMany({});
    console.log("Cleared existing safe spaces");

    await SafeSpace.insertMany(safeSpaces);
    console.log("Successfully seeded Safe Spaces");

    process.exit(0);
  } catch (error) {
    console.error("Error seeding safe spaces:", error);
    process.exit(1);
  }
};

seedSafeSpaces();
