import { api } from "encore.dev/api";
import { annotationDB } from "./db";

export interface ListAnnotationsParams {
  imageId: number;
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
