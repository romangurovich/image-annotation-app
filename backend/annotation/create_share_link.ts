import { api, APIError, Header } from "encore.dev/api";
import { appMeta } from "encore.dev";
import { secret } from "encore.dev/config";
import { annotationDB } from "./db";
import { generalLimiter, getClientIP } from "./rate_limiter";

// Configure frontend URL - defaults to standard Encore pattern if not set
const frontendUrlSecret = secret("FRONTEND_URL");

// Helper function to get frontend URL
function getFrontendUrl(): string {
  // If custom frontend URL is configured, use it
  const customUrl = frontendUrlSecret();
  if (customUrl) {
    return customUrl;
  }

  // For standard Encore URLs, convert to frontend pattern
  const apiUrl = appMeta().apiBaseUrl;
  if (apiUrl.includes(".encr.app")) {
    return apiUrl.replace(".encr.app", ".frontend.encr.app");
  }

  // For custom domains, assume frontend is served from same domain
  return apiUrl;
}

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
export const createShareLink = api<
  CreateShareLinkRequest,
  CreateShareLinkResponse
>(
  { expose: true, method: "POST", path: "/images/:imageId/share" },
  async (req) => {
    // Rate limiting
    const clientIP = getClientIP({
      "x-forwarded-for": req.xForwardedFor,
      "x-real-ip": req.xRealIP,
      "cf-connecting-ip": req.cfConnectingIP,
    });

    const rateLimitResult = generalLimiter.checkLimit(clientIP);
    if (!rateLimitResult.allowed) {
      const resetTimeSeconds = Math.ceil(
        (rateLimitResult.resetTime - Date.now()) / 1000
      );
      throw APIError.resourceExhausted(
        `Rate limit exceeded. Try again in ${resetTimeSeconds} seconds.`
      );
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
      throw APIError.permissionDenied(
        "Only the image owner can create share links"
      );
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
        shareUrl: `${getFrontendUrl()}/image/${req.imageId}?share=${existingShare.share_token}`,
      };
    }

    // Generate unique share token
    const shareToken =
      Math.random().toString(36).substring(2) + Date.now().toString(36);

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
      shareUrl: `${getFrontendUrl()}/image/${req.imageId}?share=${result.share_token}`,
    };
  }
);
