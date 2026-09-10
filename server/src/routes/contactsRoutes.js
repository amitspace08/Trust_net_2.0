import express from "express";
import {
  searchContacts,
  sendRequest,
  acceptRequest,
  rejectRequest,
  getMyCircle,
  getIncomingRequests,
} from "../controllers/contactsController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/search", protect, searchContacts);
router.post("/request", protect, sendRequest);
router.post("/request/:id/accept", protect, acceptRequest);
router.post("/request/:id/reject", protect, rejectRequest);
router.get("/my-circle", protect, getMyCircle);
router.get("/requests/incoming", protect, getIncomingRequests);

export default router;
