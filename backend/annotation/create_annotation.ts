import { api, APIError, Header } from "encore.dev/api";
import { annotationDB } from "./db";
import { generalLimiter, getClientIP } from "./rate_limiter";

export interface CreateAnnotationRequest {
  imageId: number;
  x: number;
  y: number;
  radius: number;
  xForwardedFor?: Header<"X-Forwarded-For">;
  xRealIP?: Header<"X-Real-IP">;
  cfConnectingIP?: Header<"CF-Connecting-IP">;
}

export interface Annotation {
  id: number;
  imageId: number;
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
      'x-forwarded-for': req.xForwardedFor,
      'x-real-ip': req.xRealIP,
      'cf-connecting-ip': req.cfConnectingIP,
    });
    
    const rateLimitResult = generalLimiter.checkLimit(clientIP);
    if (!rateLimitResult.allowed) {
      const resetTimeSeconds = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
      throw APIError.resourceExhausted(`Rate limit exceeded. Try again in ${resetTimeSeconds} seconds.`);
    }

    const result = await annotationDB.queryRow<{
      id: number;
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
