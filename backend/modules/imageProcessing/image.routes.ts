import { Router } from "express";
import { validate } from "../../shared/middlewares/validation.middleware";
import { requireAuth } from "../../shared/middlewares/auth.strict.middleware";
import { optionalAuthMiddleware } from "../../shared/middlewares/auth.middleware";
import {
  uploadImageSchema,
  imageIdParamSchema,
  claimGuestImagesSchema,
} from "./image.validation";

// Controllers
import {
  uploadImage,
  streamImageStatus,
  getImageDetail,
  claimGuestImages,
  getHdDownloadUrl, // <= Isko wapas add karna mat bhoolna!
} from "./image.controller";
import { uploadMiddleware } from "../../shared/middlewares/upload.middleware";

const router = Router();

// 1. Upload
router.post(
  "/upload",
  optionalAuthMiddleware,
  uploadMiddleware.single("file"),
  validate(uploadImageSchema), // 🛡️ Body validation
  uploadImage,
);

// 2. SSE Status
router.get(
  "/:imageId/events",
  optionalAuthMiddleware,
  validate(imageIdParamSchema), // 🛡️ Param validation
  streamImageStatus,
);

// 3. Get Preview
router.get(
  "/:imageId",
  optionalAuthMiddleware,
  validate(imageIdParamSchema), // 🛡️ Param validation
  getImageDetail,
);

// 4. Download HD (Missing from your snippet, but crucial!)
router.get(
  "/:imageId/download-hd",
  requireAuth,
  validate(imageIdParamSchema), // 🛡️ Param validation
  getHdDownloadUrl,
);

// 5. Claim Images
router.put(
  "/claim",
  requireAuth,
  validate(claimGuestImagesSchema), // 🛡️ Body validation
  claimGuestImages,
);

export const imageRoutes = router;
