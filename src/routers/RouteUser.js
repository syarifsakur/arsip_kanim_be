import express from "express";
import {
  createUser,
  deleteUser,
  getUser,
  getUserById,
  updateUser,
} from "../controllers/user.js";

const router = express.Router();

router.get("/", getUser);
router.get("/:id", getUserById);
router.post("/create", createUser);
router.delete("/delete/:id", deleteUser);
router.put("/update/:id", updateUser);

export default router;
