import express from "express";
import {
  updateLocation,
  toggleSharing,
  getContactsLocations,
} from "../controllers/locationController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/update", protect, updateLocation);
router.post("/sharing-toggle", protect, toggleSharing);
router.get("/contacts", protect, getContactsLocations);

export default router;
