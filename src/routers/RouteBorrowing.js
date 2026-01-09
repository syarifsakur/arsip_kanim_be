import express from "express";
import {
  createBorrowing,
  deleteBorrowing,
  getBorrowingById,
  getBorrowings,
  updateBorrowing,
  updateBorrowingStatus,
} from "../controllers/borrowing.js";
import verifyToken from "../middlewares/VerifyToken.js";

const router = express.Router();

router.get("/", getBorrowings);
router.get("/:id", getBorrowingById);
router.post("/create", createBorrowing);
router.put("/update/:id", updateBorrowing);
router.put("/update-status/:id", updateBorrowingStatus);
router.delete("/delete/:id", deleteBorrowing);

export default router;
