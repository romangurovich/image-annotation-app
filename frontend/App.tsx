import { useState } from "react";
import { ImageUpload } from "./components/ImageUpload";
import { ImageCanvas } from "./components/ImageCanvas";
import { Toaster } from "@/components/ui/toaster";

export default function App() {
  const [currentImageId, setCurrentImageId] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900">
          Image Annotation Tool
        </h1>
        
        {!currentImageId ? (
          <ImageUpload onImageUploaded={setCurrentImageId} />
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              <button
                onClick={() => setCurrentImageId(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Upload New Image
              </button>
            </div>
            <ImageCanvas imageId={currentImageId} />
          </div>
        )}
      </div>
      <Toaster />
    </div>
  );
}
