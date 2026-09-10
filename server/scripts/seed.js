import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";

// Models
import User from "../src/models/User.js";
import TrustRelationship from "../src/models/TrustRelationship.js";
import SafeSpace from "../src/models/SafeSpace.js";
import SafetyRating from "../src/models/SafetyRating.js";
import UserLocation from "../src/models/UserLocation.js";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });

let MONGODB_URI = process.env.MONGODB_URI;

export const seedDatabase = async (uriOverride) => {
  const uri = uriOverride || MONGODB_URI;
  if (!uri) {
    console.error(
      "❌ MONGODB_URI is not defined in the environment variables.",
    );
    return;
  }
  try {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(uri);
    console.log("✅ Connected successfully.\n");

    console.log("Clearing existing data...");
    await User.deleteMany({});
    await TrustRelationship.deleteMany({});
    await SafeSpace.deleteMany({});
    await SafetyRating.deleteMany({});
    await UserLocation.deleteMany({});
    console.log("✅ Data cleared.\n");

    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash("password123", salt);

    console.log("Creating Users (Priya, Rahul, Dev)...");
    const priya = await User.create({
      uid: "user_priya_123",
      displayName: "Priya Sharma",
      email: "priya@example.com",
      password: defaultPassword,
      phone_no: "+919876543210",
      photoURL: "https://i.pravatar.cc/150?u=priya",
      isGuardianAngel: false,
    });

    const rahul = await User.create({
      uid: "user_rahul_456",
      displayName: "Rahul Verma",
      email: "rahul@example.com",
      password: defaultPassword,
      phone_no: "+919876543211",
      photoURL: "https://i.pravatar.cc/150?u=rahul",
      isGuardianAngel: false,
    });

    const dev = await User.create({
      uid: "user_dev_789",
      displayName: "Dev Patel",
      email: "dev@example.com",
      password: defaultPassword,
      phone_no: "+919876543212",
      photoURL: "https://i.pravatar.cc/150?u=dev",
      isGuardianAngel: true,
      guardianVerified: true,
      guardianRating: 4.8,
      guardianResponseCount: 12,
      guardianAvailable: true,
    });

    // Create Layer 1 relationship: Priya <-> Rahul
    console.log(
      "Creating Trust Relationships (Layer 1: Priya <-> Rahul, Layer 2: Rahul <-> Dev)...",
    );
    await TrustRelationship.create({
      userA: priya.uid,
      userB: rahul.uid,
      status: "accepted",
    });

    // Create relationship for Layer 2 demonstration: Rahul <-> Dev
    await TrustRelationship.create({
      userA: rahul.uid,
      userB: dev.uid,
      status: "accepted",
    });

    console.log("Creating Locations...");
    await UserLocation.create({
      uid: priya.uid,
      location: { type: "Point", coordinates: [77.209, 28.6139] },
      timestamp: new Date(),
    });

    await UserLocation.create({
      uid: rahul.uid,
      location: { type: "Point", coordinates: [77.2095, 28.6145] }, // Nearby
      timestamp: new Date(),
    });

    await UserLocation.create({
      uid: dev.uid,
      location: { type: "Point", coordinates: [77.21, 28.615] }, // Nearby
      timestamp: new Date(),
    });

    console.log("Creating Safe Spaces...");
    await SafeSpace.create({
      name: "City Hospital",
      type: "hospital",
      address: "123 Main St, New Delhi",
      location: { type: "Point", coordinates: [77.2088, 28.6135] },
      verified: true,
      addedBy: priya.uid,
    });

    await SafeSpace.create({
      name: "24/7 Pharmacy",
      type: "pharmacy",
      address: "456 Market Road, New Delhi",
      location: { type: "Point", coordinates: [77.211, 28.612] },
      verified: true,
      addedBy: rahul.uid,
    });

    console.log("Creating Safety Ratings...");
    await SafetyRating.create({
      location: { type: "Point", coordinates: [77.209, 28.6139] },
      rating: 8,
      userId: priya.uid,
      comment: "Well lit area with constant police patrol.",
    });

    await SafetyRating.create({
      location: { type: "Point", coordinates: [77.21, 28.614] },
      rating: 4,
      userId: rahul.uid,
      comment: "Dark alleyway, feels unsafe at night.",
    });

    console.log("✅ Database seeded successfully!");
    console.log("Login Credentials:");
    console.log("Email: priya@example.com | Password: password123");

    if (require.main === module) {
      process.exit(0);
    }
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    if (require.main === module) {
      process.exit(1);
    }
  }
};

if (require.main === module) {
  seedDatabase();
}
