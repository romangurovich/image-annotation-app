import { api, APIError, Header, Query } from "encore.dev/api";
import { annotationDB } from "./db";
import { generalLimiter, getClientIP } from "./rate_limiter";

export interface CreateAnnotationRequest {
  imageId: string;
  x: number;
  y: number;
  radius: number;
  shareToken?: Query<string>;
  xForwardedFor?: Header<"X-Forwarded-For">;
  xRealIP?: Header<"X-Real-IP">;
  cfConnectingIP?: Header<"CF-Connecting-IP">;
}

export interface Annotation {
  id: string;
  imageId: string;
  x: number;
  y: number;
  radius: number;
  createdAt: Date;
}

// Creates a new annotation circle on an image.
export const createAnnotation = api<CreateAnnotationRequest, Annotation>(
  { expose: true, method: "POST", path: "/annotations" },
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

    // Check if user has access to this image
    const image = await annotationDB.queryRow<{
      user_ip: string;
    }>`
      SELECT user_ip FROM images WHERE id = ${req.imageId}
    `;

    if (!image) {
      throw APIError.notFound("Image not found");
    }

    let hasAccess = image.user_ip === clientIP;

    // If share token is provided, verify it
    if (req.shareToken) {
      const shareRecord = await annotationDB.queryRow<{ id: string }>`
        SELECT id FROM image_shares
        WHERE image_id = ${req.imageId} AND share_token = ${req.shareToken}
      `;

      if (shareRecord) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      throw APIError.permissionDenied("Access denied");
    }

    const result = await annotationDB.queryRow<{
      id: string;
      created_at: Date;
    }>`
      INSERT INTO annotations (image_id, x, y, radius)
      VALUES (${req.imageId}, ${req.x}, ${req.y}, ${req.radius})
      RETURNING id, created_at
    `;

    if (!result) {
      throw new Error("Failed to create annotation");
    }

    return {
      id: result.id,
      imageId: req.imageId,
      x: req.x,
      y: req.y,
      radius: req.radius,
      createdAt: result.created_at,
    };
  }
);
