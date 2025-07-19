import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { ImageCanvas } from "./ImageCanvas";

export function ImagePageContent() {
  const { imageId } = useParams<{ imageId: string }>();
  const [shareToken, setShareToken] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('share');
    if (token) {
      setShareToken(token);
    }
  }, []);

  const parsedImageId = imageId ? parseInt(imageId) : null;

  if (!parsedImageId || isNaN(parsedImageId)) {
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
      <ImageCanvas imageId={parsedImageId} shareToken={shareToken} />
    </div>
  );
}
