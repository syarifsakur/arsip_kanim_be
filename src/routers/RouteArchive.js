import express from "express";
import {
  createArchive,
  createImportArchive,
  deleteArchive,
  getArchive,
  getByIdArchive,
  updateArchive,
} from "../controllers/archive.js";
import verifyToken from "../middlewares/VerifyToken.js";

const router = express.Router();

router.get("/", getArchive);
router.get("/:id", getByIdArchive);
router.post("/create", createArchive);
router.post("/import", createImportArchive);
router.put("/update/:id", updateArchive);
router.delete("/delete/:id", deleteArchive);

export default router;
