import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import contactsRoutes from "./routes/contactsRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";
import sosRoutes from "./routes/sosRoutes.js";
import guardianRoutes from "./routes/guardianRoutes.js";
import safeSpaceRoutes from "./routes/safeSpaceRoutes.js";
import safetyRoutes from "./routes/safetyRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

// Middleware
const corsOptions = {
  origin: process.env.CLIENT_URL || "*",
  credentials: true,
};
app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json());

// Basic route for testing
app.get("/", (req, res) => {
  res.send("TrustNet API is running");
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/contacts", contactsRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/sos", sosRoutes);
app.use("/api/guardian", guardianRoutes);
app.use("/api/safespaces", safeSpaceRoutes);
app.use("/api/safety", safetyRoutes);

app.use(errorHandler);

export default app;
