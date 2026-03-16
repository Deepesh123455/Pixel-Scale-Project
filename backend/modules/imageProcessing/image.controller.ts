import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { catchAsync } from "../../shared/utils/CatchAsync";
import { ApiError } from "../../shared/utils/AppError";
import { db } from "../../config/db";
import { ImageTable } from "./image.schema";
import { imageQueueEvents } from "./image.queue";


import {
  uploadImageService,
  getImageDetailService,
  claimGuestImagesService,
  getHdDownloadUrlService
} from "./image.service";


export const uploadImage = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const guestId = (req.headers["x-guest-id"] as string) || req.body.guestId;
  const file = req.file;

  if (!userId && !guestId)
    throw new ApiError("Authentication or valid Guest ID required", 401);
  if (!file) throw new ApiError("Please upload an image file", 400);

  let operations: string[] = [];
  let resizeParams = undefined;

  try {
    if (req.body.operations) operations = JSON.parse(req.body.operations);
    if (req.body.resizeParams) resizeParams = JSON.parse(req.body.resizeParams);
  } catch (e) {
    throw new ApiError("Invalid parameters format", 400);
  }

  const result = await uploadImageService(
    userId,
    guestId,
    file,
    operations,
    resizeParams,
  );

  res.status(202).json({
    status: "success",
    message: "Image vaulted successfully. Processing engine engaged.",
    data: {
      imageId: result.id,
      sseEndpoint: `/api/v1/images/${result.id}/events`,
    },
  });
});

// 📡 2. REAL-TIME SSE CONTROLLER (With Race-Condition Fix)
export const streamImageStatus = async (req: Request, res: Response) => {
  const { imageId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (payload: any) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  // 🛠️ THE FIX: Check if already completed before listening
  const [existingImage] = await db
    .select()
    .from(ImageTable)
    .where(eq(ImageTable.id, imageId as string));

  if (existingImage && existingImage.status === "completed") {
    sendEvent({ status: "completed", data: { imageId } });
    return res.end(); // Turant pipe close kardo
  }
  if (existingImage && existingImage.status === "failed") {
    sendEvent({ status: "failed", error: "Processing failed" });
    return res.end();
  }

  // Initial message
  sendEvent({ status: "connected", message: "Listening for updates..." });

  const onCompleted = async ({ jobId, returnvalue }: any) => {
    if (jobId === imageId) {
      sendEvent({ status: "completed", data: returnvalue });
      cleanup();
    }
  };

  const onFailed = ({ jobId, failedReason }: any) => {
    if (jobId === imageId) {
      sendEvent({ status: "failed", error: failedReason });
      cleanup();
    }
  };

  imageQueueEvents.on("completed", onCompleted);
  imageQueueEvents.on("failed", onFailed);

  const cleanup = () => {
    imageQueueEvents.off("completed", onCompleted);
    imageQueueEvents.off("failed", onFailed);
    res.end();
  };

  req.on("close", cleanup);
};

// 📥 3. FETCH IMAGE DETAILS CONTROLLER
// 📥 3. FETCH IMAGE DETAILS CONTROLLER (Flexible Ownership Check)
export const getImageDetail = catchAsync(
  async (req: Request, res: Response) => {
    // Force string type taaki TypeScript error na de
    const imageId = req.params.imageId as string;

    // Auth aur Guest details pakdo
    const userId = req.user?.id;
    const guestId =
      (req.headers["x-guest-id"] as string) || (req.query.guestId as string);

    // Teeno service ko bhej do
    const imageDetails = await getImageDetailService(imageId, userId, guestId);

    res.status(200).json({
      status: "success",
      data: imageDetails,
    });
  },
);

export const getHdDownloadUrl = catchAsync(
  async (req: Request, res: Response) => {
    const imageId = req.params.imageId as string;

    // Auth aur Guest details pakdo
    const userId = req.user?.id;
    const guestId =
      (req.headers["x-guest-id"] as string) || (req.query.guestId as string);

    // Service check karegi ki user actual owner hai ya nahi, tabhi URL degi
    const downloadUrl = await getHdDownloadUrlService(imageId, userId, guestId);

    res.status(200).json({
      status: "success",
      data: {
        downloadUrl, // 5-minute Presigned URL directly from S3 Private Vault
      },
    });
  },
);

// 🔄 4. CLAIM GUEST IMAGES CONTROLLER
export const claimGuestImages = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { guestId } = req.body;

    if (!userId)
      throw new ApiError("You must be logged in to claim images", 401);

    const imagesClaimed = await claimGuestImagesService(userId, guestId);

    res.status(200).json({
      status: "success",
      message: `Successfully transferred ${imagesClaimed} images to your new account! 🎉`,
    });
  },
);
