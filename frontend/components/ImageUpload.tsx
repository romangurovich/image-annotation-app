import { useState } from "react";
import { Upload } from "lucide-react";
import backend from "~backend/client";
import { useToast } from "@/components/ui/use-toast";

interface ImageUploadProps {
  onImageUploaded: (imageId: number) => void;
}

export function ImageUpload({ onImageUploaded }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

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

    setIsUploading(true);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const base64WithoutPrefix = base64Data.split(",")[1];

          const response = await backend.annotation.uploadImage({
            filename: file.name,
            imageData: base64WithoutPrefix,
          });

          onImageUploaded(response.imageId);
          toast({
            title: "Image uploaded successfully",
            description: "You can now start annotating your image.",
          });
        } catch (error) {
          console.error("Upload error:", error);
          toast({
            title: "Upload failed",
            description: "Failed to upload image. Please try again.",
            variant: "destructive",
          });
        } finally {
          setIsUploading(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error("File reading error:", error);
      toast({
        title: "File reading failed",
        description: "Failed to read the selected file.",
        variant: "destructive",
      });
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
          Select an image file to start annotating
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
