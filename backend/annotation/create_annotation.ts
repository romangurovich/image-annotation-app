import { api } from "encore.dev/api";
import { annotationDB } from "./db";

export interface CreateAnnotationRequest {
  imageId: number;
  x: number;
  y: number;
  radius: number;
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
