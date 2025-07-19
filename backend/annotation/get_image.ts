import { api, APIError } from "encore.dev/api";
import { annotationDB } from "./db";
import { imagesBucket } from "./storage";

export interface GetImageParams {
  id: number;
}

export interface ImageData {
  id: number;
  filename: string;
  originalFilename: string;
  imageUrl: string;
  createdAt: Date;
}

// Retrieves image data by ID.
export const getImage = api<GetImageParams, ImageData>(
  { expose: true, method: "GET", path: "/images/:id" },
  async (params) => {
    const image = await annotationDB.queryRow<{
      id: number;
      filename: string;
      original_filename: string;
      created_at: Date;
    }>`
      SELECT id, filename, original_filename, created_at
      FROM images
      WHERE id = ${params.id}
    `;
    
    if (!image) {
      throw APIError.notFound("Image not found");
    }
    
    const imageUrl = imagesBucket.publicUrl(image.filename);
    
    return {
      id: image.id,
      filename: image.filename,
      originalFilename: image.original_filename,
      imageUrl,
      createdAt: image.created_at,
    };
  }
);
