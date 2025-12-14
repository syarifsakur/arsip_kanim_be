import express from "express";
import { createBorrowing, deleteBorrowing, getBorrowings } from "../controllers/borrowing.js";
import verifyToken from "../middlewares/VerifyToken.js";

const router = express.Router();

router.get("/", getBorrowings);
router.post("/create", createBorrowing);
router.delete("/delete/:id", deleteBorrowing);

export default router;
