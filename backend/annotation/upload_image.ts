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
  imageId: number;
  uploadUrl: string;
  imageUrl: string;
}

// Creates a new image record and returns a signed upload URL.
export const uploadImage = api<UploadImageRequest, UploadImageResponse>(
  { expose: true, method: "POST", path: "/images/upload" },
  async (req) => {
    // Rate limiting
    const clientIP = getClientIP({
      'x-forwarded-for': req.xForwardedFor,
      'x-real-ip': req.xRealIP,
      'cf-connecting-ip': req.cfConnectingIP,
    });
    
    const rateLimitResult = uploadLimiter.checkLimit(clientIP);
    if (!rateLimitResult.allowed) {
      const resetTimeSeconds = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
      throw APIError.resourceExhausted(`Upload rate limit exceeded. Try again in ${resetTimeSeconds} seconds.`);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = req.filename.split('.').pop() || 'jpg';
    const uniqueFilename = `${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`;
    
    // Save to database first
    const result = await annotationDB.queryRow<{ id: number }>`
      INSERT INTO images (filename, original_filename)
      VALUES (${uniqueFilename}, ${req.filename})
      RETURNING id
    `;
    
    if (!result) {
      throw new Error("Failed to save image to database");
    }
    
    // Generate signed upload URL
    const { url: uploadUrl } = await imagesBucket.signedUploadUrl(uniqueFilename, {
      ttl: 3600, // 1 hour
    });
    
    const imageUrl = imagesBucket.publicUrl(uniqueFilename);
    
    return {
      imageId: result.id,
      uploadUrl,
      imageUrl,
    };
  }
);
