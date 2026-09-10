import mongoose from "mongoose";
import User from "../models/User.js";
import TrustRelationship from "../models/TrustRelationship.js";
import bcrypt from "bcryptjs";

const URI = "mongodb://127.0.0.1:27017/trustnet";

export const seedDatabase = async () => {
  try {
    console.log("Seeding Database...");

    // Clear existing users and relationships for a fresh seed
    await User.deleteMany({
      uid: { $in: ["priya", "mum", "riya", "dev", "anita"] },
    });
    await TrustRelationship.deleteMany({
      $or: [
        { requesterUid: { $in: ["priya", "mum", "riya", "dev", "anita"] } },
        { targetUid: { $in: ["priya", "mum", "riya", "dev", "anita"] } },
      ],
    });

    const hash = await bcrypt.hash("password123", 10);

    // Distressed User (Priya) in Connaught Place, Delhi
    const priya = await User.create({
      uid: "priya",
      displayName: "Priya",
      email: "priya@example.com",
      passwordHash: hash,
      phone_no: "+919999999991",
      locationSharingEnabled: true,
      location: {
        type: "Point",
        coordinates: [77.209, 28.6139], // [lng, lat]
      },
    });

    // Layer 1 Contacts
    const mum = await User.create({
      uid: "mum",
      displayName: "Mum",
      email: "mum@example.com",
      passwordHash: hash,
      phone_no: "+919999999992",
      locationSharingEnabled: true,
      location: {
        type: "Point",
        coordinates: [77.208, 28.614], // Very close
      },
    });

    const riya = await User.create({
      uid: "riya",
      displayName: "Riya",
      email: "riya@example.com",
      passwordHash: hash,
      phone_no: "+919999999993",
      locationSharingEnabled: true,
      location: {
        type: "Point",
        coordinates: [77.205, 28.615], // Also close
      },
    });

    // Layer 2 Contacts
    const dev = await User.create({
      uid: "dev",
      displayName: "Dev",
      email: "dev@example.com",
      passwordHash: hash,
      phone_no: "+919999999994",
      locationSharingEnabled: true,
      location: {
        type: "Point",
        coordinates: [77.2075, 28.6135], // ~300m away
      },
    });

    const anita = await User.create({
      uid: "anita",
      displayName: "Anita",
      email: "anita@example.com",
      passwordHash: hash,
      phone_no: "+919999999995",
      locationSharingEnabled: true,
      location: {
        type: "Point",
        coordinates: [77.21, 28.6125], // ~400m away
      },
    });

    console.log("Users created");

    // 2. Setup Relationships
    // Priya <-> Mum (L1)
    await TrustRelationship.create({
      requesterUid: "priya",
      targetUid: "mum",
      status: "accepted",
    });
    // Priya <-> Riya (L1)
    await TrustRelationship.create({
      requesterUid: "priya",
      targetUid: "riya",
      status: "accepted",
    });

    // Mum <-> Dev (L2 for Priya)
    await TrustRelationship.create({
      requesterUid: "mum",
      targetUid: "dev",
      status: "accepted",
    });

    // Riya <-> Anita (L2 for Priya)
    await TrustRelationship.create({
      requesterUid: "riya",
      targetUid: "anita",
      status: "accepted",
    });

    console.log("Relationships created");
    console.log("Seed complete! Test users:");
    console.log("- priya@example.com / password123 (Distressed User)");
    console.log("- mum@example.com / password123 (Layer 1)");
    console.log("- riya@example.com / password123 (Layer 1)");
    console.log("- dev@example.com / password123 (Layer 2 via Mum)");
    console.log("- anita@example.com / password123 (Layer 2 via Riya)");

    return true;
  } catch (error) {
    console.error("Error seeding:", error);
    return false;
  }
};
