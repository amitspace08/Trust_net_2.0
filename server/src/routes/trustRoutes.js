import express from "express";
import {
  sendInvite,
  getContacts,
  handleInvite,
} from "../controllers/trustController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/contacts", protect, getContacts);
router.post("/invite", protect, sendInvite);
router.put("/invitations/:id", protect, handleInvite);

export default router;
