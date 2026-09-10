import http from "http";
import dotenv from "dotenv";
import { Server } from "socket.io";
import app from "./app.js";
import connectDB from "./config/db.js";

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const server = http.createServer(app);

// Initialize Socket.io
export const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*", // Configure this in production
    methods: ["GET", "POST"],
    credentials: true,
  },
});

import { initializeSocketHandlers } from "./sockets/index.js";

initializeSocketHandlers(io);

const PORT = process.env.PORT || 5000;

if (process.env.IS_TEST_ENV !== "true") {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
