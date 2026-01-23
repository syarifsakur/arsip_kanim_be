import express from "express";
import {
  createBorrowing,
  deleteBorrowing,
  getBorrowingById,
  getBorrowings,
  getBorrowingUser,
  updateBorrowing,
  updateBorrowingStatus,
} from "../controllers/borrowing.js";
import verifyToken from "../middlewares/VerifyToken.js";

const router = express.Router();

router.get("/", getBorrowings);
router.get("/user", verifyToken, getBorrowingUser);
router.get("/:id", getBorrowingById);
router.post("/create", verifyToken, createBorrowing);
router.put("/update/:id", verifyToken, updateBorrowing);
router.put("/update-status/:id", verifyToken, updateBorrowingStatus);
router.delete("/delete/:id", verifyToken, deleteBorrowing);

export default router;
