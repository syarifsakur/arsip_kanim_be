import express from "express";
import dotenv from "dotenv";
import db from "./configs/database.js";
import cors from "cors";
import rateLimit from "express-rate-limit";
import fileUpload from "express-fileupload";
import cookieParser from "cookie-parser";

import RouteAuth from "./routers/RouteAuth.js";
// import RouteBarang from "./routers/RouteBarang.js";
// import RouteAdmin from "./routers/RouteAdmin.js";
import RouteArchive from "./routers/RouteArchive.js";
import RouteBorrowing from "./routers/RouteBorrowing.js";
import RouteUser from "./routers/RouteUser.js";

import createModel from "./models/ModelArchive.js";
import { Login } from "./controllers/auth.js";
import { purgeExpiredBorrowings } from "./controllers/borrowing.js";

const app = express();
dotenv.config();

async function initializeDatabase() {
  try {
    await db.authenticate();
    console.log("Database connected");
    // await db.sync()
    // await createModel.sync({ alter: true });

    if (!borrowingCleanupTimer) {
      await runBorrowingCleanup();
      borrowingCleanupTimer = setInterval(
        runBorrowingCleanup,
        BORROWING_CLEANUP_INTERVAL_MS,
      );

      if (typeof borrowingCleanupTimer.unref === "function") {
        borrowingCleanupTimer.unref();
      }
    }
  } catch (error) {
    console.error("Database error:", error);
  }
}

initializeDatabase();

const BORROWING_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let borrowingCleanupTimer;

const runBorrowingCleanup = async () => {
  try {
    const removed = await purgeExpiredBorrowings();
    if (removed > 0) {
      console.log(`Borrowing cleanup removed ${removed} expired record(s)`);
    }
  } catch (error) {
    console.error("Borrowing cleanup error:", error);
  }
};

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: "Melebihi batas request ke server.",
});

app.use(
  cors({
    credentials: true,
    origin: "http://localhost:5173",
  }),
);
app.use("/public", express.static("public"));
app.use("/uploads", express.static("uploads"));
app.use(fileUpload());
app.use(express.json());
app.use(cookieParser());

// end-point api
app.use("/auth", RouteAuth);
app.use("/archive", RouteArchive);
app.use("/borrowing", RouteBorrowing);
app.use("/user", RouteUser);

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
