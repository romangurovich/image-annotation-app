import { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ImageUpload } from "./components/ImageUpload";
import { UserImages } from "./components/UserImages";
import { ImagePageContent } from "./components/ImagePageContent";
import { AnnotationPageContent } from "./components/AnnotationPageContent";
import { Toaster } from "@/components/ui/toaster";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-center mb-8 text-gray-900">
            Image Annotation Tool
          </h1>

          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/image/:imageId" element={<ImagePageContent />} />
            <Route
              path="/annotate/:imageId"
              element={<AnnotationPageContent />}
            />
            <Route path="/my-images" element={<UserImages />} />
          </Routes>
        </div>
        <Toaster />
      </div>
    </Router>
  );
}

function HomePage() {
  const [currentImageId, setCurrentImageId] = useState<string | null>(null);

  if (currentImageId) {
    return <Navigate to={`/annotate/${currentImageId}`} replace />;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <a
          href="/my-images"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          View My Images
        </a>
      </div>
      <ImageUpload onImageUploaded={setCurrentImageId} />
    </div>
  );
}
