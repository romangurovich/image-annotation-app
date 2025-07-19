import { api, APIError, Header } from "encore.dev/api";
import { annotationDB } from "./db";
import { generalLimiter, getClientIP } from "./rate_limiter";

export interface CreateShareLinkRequest {
  imageId: string;
  xForwardedFor?: Header<"X-Forwarded-For">;
  xRealIP?: Header<"X-Real-IP">;
  cfConnectingIP?: Header<"CF-Connecting-IP">;
}

export interface CreateShareLinkResponse {
  shareToken: string;
  shareUrl: string;
}

// Creates a shareable link for an image.
export const createShareLink = api<CreateShareLinkRequest, CreateShareLinkResponse>(
  { expose: true, method: "POST", path: "/images/:imageId/share" },
  async (req) => {
    // Rate limiting
    const clientIP = getClientIP({
      'x-forwarded-for': req.xForwardedFor,
      'x-real-ip': req.xRealIP,
      'cf-connecting-ip': req.cfConnectingIP,
    });
    
    const rateLimitResult = generalLimiter.checkLimit(clientIP);
    if (!rateLimitResult.allowed) {
      const resetTimeSeconds = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
      throw APIError.resourceExhausted(`Rate limit exceeded. Try again in ${resetTimeSeconds} seconds.`);
    }

    // Check if user owns this image
    const image = await annotationDB.queryRow<{
      user_ip: string;
    }>`
      SELECT user_ip FROM images WHERE id = ${req.imageId}
    `;
    
    if (!image) {
      throw APIError.notFound("Image not found");
    }

    if (image.user_ip !== clientIP) {
      throw APIError.permissionDenied("Only the image owner can create share links");
    }

    // Check if share link already exists
    const existingShare = await annotationDB.queryRow<{
      share_token: string;
    }>`
      SELECT share_token FROM image_shares WHERE image_id = ${req.imageId}
    `;

    if (existingShare) {
      return {
        shareToken: existingShare.share_token,
        shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/image/${req.imageId}?share=${existingShare.share_token}`,
      };
    }

    // Generate unique share token
    const shareToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    const result = await annotationDB.queryRow<{
      share_token: string;
    }>`
      INSERT INTO image_shares (image_id, share_token)
      VALUES (${req.imageId}, ${shareToken})
      RETURNING share_token
    `;
    
    if (!result) {
      throw new Error("Failed to create share link");
    }
    
    return {
      shareToken: result.share_token,
      shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/image/${req.imageId}?share=${result.share_token}`,
    };
  }
);
