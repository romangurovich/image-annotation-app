import { api, APIError, Header } from "encore.dev/api";
import { annotationDB } from "./db";
import { generalLimiter, getClientIP } from "./rate_limiter";

export interface ListAnnotationsParams {
  imageId: number;
  xForwardedFor?: Header<"X-Forwarded-For">;
  xRealIP?: Header<"X-Real-IP">;
  cfConnectingIP?: Header<"CF-Connecting-IP">;
}

export interface ListAnnotationsResponse {
  annotations: Annotation[];
}

export interface Annotation {
  id: number;
  imageId: number;
  x: number;
  y: number;
  radius: number;
  createdAt: Date;
}

// Retrieves all annotations for an image.
export const listAnnotations = api<ListAnnotationsParams, ListAnnotationsResponse>(
  { expose: true, method: "GET", path: "/images/:imageId/annotations" },
  async (params) => {
    // Rate limiting
    const clientIP = getClientIP({
      'x-forwarded-for': params.xForwardedFor,
      'x-real-ip': params.xRealIP,
      'cf-connecting-ip': params.cfConnectingIP,
    });
    
    const rateLimitResult = generalLimiter.checkLimit(clientIP);
    if (!rateLimitResult.allowed) {
      const resetTimeSeconds = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
      throw APIError.resourceExhausted(`Rate limit exceeded. Try again in ${resetTimeSeconds} seconds.`);
    }

    const annotations: Annotation[] = [];
    
    for await (const row of annotationDB.query<{
      id: number;
      image_id: number;
      x: number;
      y: number;
      radius: number;
      created_at: Date;
    }>`
      SELECT id, image_id, x, y, radius, created_at
      FROM annotations
      WHERE image_id = ${params.imageId}
      ORDER BY created_at ASC
    `) {
      annotations.push({
        id: row.id,
        imageId: row.image_id,
        x: row.x,
        y: row.y,
        radius: row.radius,
        createdAt: row.created_at,
      });
    }
    
    return { annotations };
  }
);
