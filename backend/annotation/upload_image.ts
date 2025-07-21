import { api, APIError, Header } from "encore.dev/api";
import { annotationDB } from "./db";
import { imagesBucket } from "./storage";
import { uploadLimiter, getClientIP } from "./rate_limiter";

export interface UploadImageRequest {
  filename: string;
  contentType: string;
  xForwardedFor?: Header<"X-Forwarded-For">;
  xRealIP?: Header<"X-Real-IP">;
  cfConnectingIP?: Header<"CF-Connecting-IP">;
}

export interface UploadImageResponse {
  imageId: string;
  uploadUrl: string;
  imageUrl: string;
  thumbnailUploadUrl: string;
}

// Creates a new image record and returns signed upload URLs for both full image and thumbnail.
export const uploadImage = api<UploadImageRequest, UploadImageResponse>(
  { expose: true, method: "POST", path: "/images/upload" },
  async (req) => {
    // Rate limiting
    const clientIP = getClientIP({
      "x-forwarded-for": req.xForwardedFor,
      "x-real-ip": req.xRealIP,
      "cf-connecting-ip": req.cfConnectingIP,
    });

    const rateLimitResult = uploadLimiter.checkLimit(clientIP);
    if (!rateLimitResult.allowed) {
      const resetTimeSeconds = Math.ceil(
        (rateLimitResult.resetTime - Date.now()) / 1000
      );
      throw APIError.resourceExhausted(
        `Upload rate limit exceeded. Try again in ${resetTimeSeconds} seconds.`
      );
    }

    // Generate unique filenames
    const timestamp = Date.now();
    const extension = req.filename.split(".").pop() || "jpg";
    const randomId = Math.random().toString(36).substring(7);
    const uniqueFilename = `${timestamp}-${randomId}.${extension}`;
    const thumbnailFilename = `thumb_${timestamp}-${randomId}.${extension}`;

    // Save to database with user IP and thumbnail filename
    const result = await annotationDB.queryRow<{ id: string }>`
      INSERT INTO images (filename, original_filename, thumbnail_filename, user_ip)
      VALUES (${uniqueFilename}, ${req.filename}, ${thumbnailFilename}, ${clientIP})
      RETURNING id
    `;

    if (!result) {
      throw new Error("Failed to save image to database");
    }

    // Generate signed upload URLs for both full image and thumbnail
    const { url: uploadUrl } = await imagesBucket.signedUploadUrl(
      uniqueFilename,
      {
        ttl: 3600, // 1 hour
      }
    );

    const { url: thumbnailUploadUrl } = await imagesBucket.signedUploadUrl(
      thumbnailFilename,
      {
        ttl: 3600, // 1 hour
      }
    );

    const imageUrl = imagesBucket.publicUrl(uniqueFilename);

    return {
      imageId: result.id,
      uploadUrl,
      imageUrl,
      thumbnailUploadUrl,
    };
  }
);
