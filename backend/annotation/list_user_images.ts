import { api, APIError, Header } from "encore.dev/api";
import { annotationDB } from "./db";
import { imagesBucket } from "./storage";
import { generalLimiter, getClientIP } from "./rate_limiter";

export interface ListUserImagesParams {
  xForwardedFor?: Header<"X-Forwarded-For">;
  xRealIP?: Header<"X-Real-IP">;
  cfConnectingIP?: Header<"CF-Connecting-IP">;
}

export interface ListUserImagesResponse {
  images: UserImage[];
}

export interface UserImage {
  id: string;
  filename: string;
  originalFilename: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  createdAt: Date;
  annotationCount: number;
}

// Retrieves all images uploaded by the current user.
export const listUserImages = api<ListUserImagesParams, ListUserImagesResponse>(
  { expose: true, method: "GET", path: "/user/images" },
  async (params) => {
    // Rate limiting
    const clientIP = getClientIP({
      "x-forwarded-for": params.xForwardedFor,
      "x-real-ip": params.xRealIP,
      "cf-connecting-ip": params.cfConnectingIP,
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

    const images: UserImage[] = [];

    for await (const row of annotationDB.query<{
      id: string;
      filename: string;
      original_filename: string;
      thumbnail_filename: string | null;
      created_at: Date;
      annotation_count: number;
    }>`
      SELECT 
        i.id, 
        i.filename, 
        i.original_filename,
        i.thumbnail_filename,
        i.created_at,
        COUNT(a.id) as annotation_count
      FROM images i
      LEFT JOIN annotations a ON i.id = a.image_id
      WHERE i.user_ip = ${clientIP}
      GROUP BY i.id, i.filename, i.original_filename, i.thumbnail_filename, i.created_at
      ORDER BY i.created_at DESC
    `) {
      const imageUrl = imagesBucket.publicUrl(row.filename);
      const thumbnailUrl = row.thumbnail_filename
        ? imagesBucket.publicUrl(row.thumbnail_filename)
        : null;

      images.push({
        id: row.id,
        filename: row.filename,
        originalFilename: row.original_filename,
        imageUrl,
        thumbnailUrl,
        createdAt: row.created_at,
        annotationCount: Number(row.annotation_count),
      });
    }

    return { images };
  }
);
