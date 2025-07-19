import { api, APIError, Header, Query } from "encore.dev/api";
import { annotationDB } from "./db";
import { imagesBucket } from "./storage";
import { generalLimiter, getClientIP } from "./rate_limiter";

export interface GetImageParams {
  id: number;
  shareToken?: Query<string>;
  xForwardedFor?: Header<"X-Forwarded-For">;
  xRealIP?: Header<"X-Real-IP">;
  cfConnectingIP?: Header<"CF-Connecting-IP">;
}

export interface ImageData {
  id: number;
  filename: string;
  originalFilename: string;
  imageUrl: string;
  createdAt: Date;
  canEdit: boolean;
}

// Retrieves image data by ID.
export const getImage = api<GetImageParams, ImageData>(
  { expose: true, method: "GET", path: "/images/:id" },
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

    const image = await annotationDB.queryRow<{
      id: number;
      filename: string;
      original_filename: string;
      user_ip: string;
      created_at: Date;
    }>`
      SELECT id, filename, original_filename, user_ip, created_at
      FROM images
      WHERE id = ${params.id}
    `;
    
    if (!image) {
      throw APIError.notFound("Image not found");
    }

    // Check if user has access to this image
    let canEdit = image.user_ip === clientIP;

    // If share token is provided, verify it
    if (params.shareToken) {
      const shareRecord = await annotationDB.queryRow<{ id: number }>`
        SELECT id FROM image_shares
        WHERE image_id = ${params.id} AND share_token = ${params.shareToken}
      `;
      
      if (!shareRecord) {
        throw APIError.notFound("Invalid share token");
      }
      
      // Shared users can edit (comment) but not own the image
      canEdit = true;
    } else if (!canEdit) {
      // No share token and not the owner
      throw APIError.permissionDenied("Access denied");
    }
    
    const imageUrl = imagesBucket.publicUrl(image.filename);
    
    return {
      id: image.id,
      filename: image.filename,
      originalFilename: image.original_filename,
      imageUrl,
      createdAt: image.created_at,
      canEdit,
    };
  }
);
