import multer from "multer";
import { ApiError } from "../utils/AppError"; // Tumhara custom error handler

// 1. RAM Storage Engine (No Disk Touch! ⚡)
const storage = multer.memoryStorage();

// 2. Strict Bouncer for Files (Sirf Images allow karni hain)
const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Check if the uploaded file is an image
  if (file.mimetype.startsWith("image/")) {
    cb(null, true); // Entry Allowed ✅
  } else {
    // Agar user ne PDF ya Video daal di toh yahin se bhaga do
    cb(new ApiError("Invalid file type. Only image files are allowed!", 400) as any, false);
  }
};

// 3. The Middleware Instance
export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    // ⚠️ CRITICAL: Kyunki file RAM mein rukegi, isliye limit lagana zaroori hai
    // warna koi 5GB ki file bhej kar tumhara server crash kar dega.
    fileSize: 10 * 1024 * 1024, // 10 MB max limit per image
  },
});