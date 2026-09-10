import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { seedDatabase } from "../scripts/seed.js";

const connectDB = async () => {
  try {
    let uri = process.env.MONGODB_URI || "mongodb://localhost:27017/trustnet";

    let mongod = null;
    // Auto-fallback to In-Memory DB only if explicitly requested or MONGODB_URI is not provided
    if (uri === "memory" || process.env.USE_MEMORY_DB === "true") {
      mongod = await MongoMemoryServer.create({
        binary: { version: "4.4.29" },
      });
      uri = mongod.getUri();
      console.log(`Using In-Memory MongoDB for local development`);
    }

    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    if (uri.includes("127.0.0.1") && mongod) {
      // Seed if we just created an in-memory server
      await seedDatabase(uri);
    }
  } catch (error) {
    console.error(`MongoDB connection failed (Warning): ${error.message}`);
    console.warn(
      "The server will continue to run, but database features will not work until MongoDB is connected.",
    );
  }
};

export default connectDB;
