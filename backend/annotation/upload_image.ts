import { api } from "encore.dev/api";
import { annotationDB } from "./db";
import { imagesBucket } from "./storage";

export interface UploadImageRequest {
  filename: string;
  imageData: string; // base64 encoded image data
}

export interface UploadImageResponse {
  imageId: number;
  imageUrl: string;
}

// Uploads an image and returns the image ID and URL.
export const uploadImage = api<UploadImageRequest, UploadImageResponse>(
  { expose: true, method: "POST", path: "/images" },
  async (req) => {
    // Decode base64 image data
    const imageBuffer = Buffer.from(req.imageData, "base64");
    
    // Generate unique filename
    const timestamp = Date.now();
    const extension = req.filename.split('.').pop() || 'jpg';
    const uniqueFilename = `${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`;
    
    // Upload to object storage
    await imagesBucket.upload(uniqueFilename, imageBuffer, {
      contentType: `image/${extension}`,
    });
    
    // Save to database
    const result = await annotationDB.queryRow<{ id: number }>`
      INSERT INTO images (filename, original_filename)
      VALUES (${uniqueFilename}, ${req.filename})
      RETURNING id
    `;
    
    if (!result) {
      throw new Error("Failed to save image to database");
    }
    
    const imageUrl = imagesBucket.publicUrl(uniqueFilename);
    
    return {
      imageId: result.id,
      imageUrl,
    };
  }
);
