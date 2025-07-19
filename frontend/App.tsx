import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ImageUpload } from "./components/ImageUpload";
import { ImageCanvas } from "./components/ImageCanvas";
import { UserImages } from "./components/UserImages";
import { AnnotationScreen } from "./components/AnnotationScreen";
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
            <Route path="/image/:imageId" element={<ImagePage />} />
            <Route path="/annotate/:imageId" element={<AnnotationPage />} />
            <Route path="/my-images" element={<UserImages />} />
          </Routes>
        </div>
        <Toaster />
      </div>
    </Router>
  );
}

function HomePage() {
  const [currentImageId, setCurrentImageId] = useState<number | null>(null);

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

function ImagePage() {
  const [imageId, setImageId] = useState<number | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);

  useEffect(() => {
    const pathParts = window.location.pathname.split('/');
    const id = parseInt(pathParts[pathParts.length - 1]);
    if (!isNaN(id)) {
      setImageId(id);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('share');
    if (token) {
      setShareToken(token);
    }
  }, []);

  if (!imageId) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <a
          href="/"
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          ← Back to Home
        </a>
        <a
          href="/my-images"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          My Images
        </a>
      </div>
      <ImageCanvas imageId={imageId} shareToken={shareToken} />
    </div>
  );
}

function AnnotationPage() {
  const [imageId, setImageId] = useState<number | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);

  useEffect(() => {
    const pathParts = window.location.pathname.split('/');
    const id = parseInt(pathParts[pathParts.length - 1]);
    if (!isNaN(id)) {
      setImageId(id);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('share');
    if (token) {
      setShareToken(token);
    }
  }, []);

  if (!imageId) {
    return <Navigate to="/" replace />;
  }

  return <AnnotationScreen imageId={imageId} shareToken={shareToken} />;
}
