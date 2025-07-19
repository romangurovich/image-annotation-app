import { useState } from "react";
import { Upload } from "lucide-react";
import backend from "~backend/client";
import { useToast } from "@/components/ui/use-toast";

interface ImageUploadProps {
  onImageUploaded: (imageId: string) => void;
}

export function ImageUpload({ onImageUploaded }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const createThumbnail = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate thumbnail dimensions (max 400px width/height, maintain aspect ratio)
        const maxSize = 400;
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress the image
        ctx!.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create thumbnail'));
            }
          },
          'image/jpeg',
          0.8 // 80% quality
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 10MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Create thumbnail
      const thumbnailBlob = await createThumbnail(file);

      // Get signed upload URLs from backend
      const response = await backend.annotation.uploadImage({
        filename: file.name,
        contentType: file.type,
      });

      // Upload both full image and thumbnail in parallel
      const [uploadResponse, thumbnailResponse] = await Promise.all([
        fetch(response.uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        }),
        fetch(response.thumbnailUploadUrl, {
          method: "PUT",
          body: thumbnailBlob,
          headers: {
            "Content-Type": "image/jpeg",
          },
        })
      ]);

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      if (!thumbnailResponse.ok) {
        console.warn(`Thumbnail upload failed: ${thumbnailResponse.status} ${thumbnailResponse.statusText}`);
        // Continue even if thumbnail upload fails
      }

      onImageUploaded(response.imageId);
      toast({
        title: "Image uploaded successfully",
        description: "You can now start annotating your image.",
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      
      if (error?.code === "resource_exhausted") {
        toast({
          title: "Upload rate limit exceeded",
          description: error.message || "Too many uploads. Please wait before uploading another image.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Upload failed",
          description: "Failed to upload image. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Upload an image
        </h3>
        <p className="text-gray-600 mb-4">
          Select an image file to start annotating (max 10MB)
        </p>
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
          />
          <span className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
            {isUploading ? "Uploading..." : "Choose File"}
          </span>
        </label>
      </div>
    </div>
  );
}
