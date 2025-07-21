import { useEffect, useState, useCallback } from "react";
import { Eye, MessageCircle, Calendar, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import backend from "~backend/client";
import { useToast } from "@/components/ui/use-toast";
import type { UserImage } from "~backend/annotation/list_user_images";

export function UserImages() {
  const [images, setImages] = useState<UserImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const loadUserImages = useCallback(async () => {
    try {
      const response = await backend.annotation.listUserImages({});
      setImages(response.images);
    } catch (error: unknown) {
      const apiError = error as { code?: string; message?: string };
      console.error("Failed to load user images:", error);

      if (apiError?.code === "resource_exhausted") {
        toast({
          title: "Rate limit exceeded",
          description:
            apiError.message ||
            "Too many requests. Please wait before trying again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to load images",
          description: "Could not load your images. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadUserImages();
  }, [loadUserImages]);

  const handleViewImage = (imageId: string) => {
    navigate(`/image/${imageId}`);
  };

  const handleAnnotateImage = (imageId: string) => {
    navigate(`/annotate/${imageId}`);
  };

  const handleImageError = (
    e: React.SyntheticEvent<HTMLImageElement>,
    image: UserImage
  ) => {
    const target = e.target as HTMLImageElement;

    // If thumbnail failed and we haven't tried the full image yet, try the full image
    if (
      target.src === image.thumbnailUrl &&
      image.imageUrl !== image.thumbnailUrl
    ) {
      target.src = image.imageUrl;
      return;
    }

    // If both failed or no thumbnail, show fallback
    target.style.display = "none";
    target.parentElement!.innerHTML = `
      <div class="w-full h-full flex items-center justify-center text-gray-400">
        <svg class="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" />
        </svg>
      </div>
    `;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500">Loading your images...</div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-4">
          You haven&apos;t uploaded any images yet.
        </div>
        <a
          href="/"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Upload Your First Image
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">My Images</h2>
        <a
          href="/"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Upload New Image
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {images.map((image) => (
          <div
            key={image.id}
            className="bg-white rounded-lg shadow-lg overflow-hidden"
          >
            <div className="aspect-video bg-gray-100 overflow-hidden">
              <img
                src={image.thumbnailUrl || image.imageUrl}
                alt={image.originalFilename}
                className="w-full h-full object-cover transition-opacity duration-200"
                loading="lazy"
                onError={(e) => handleImageError(e, image)}
              />
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 mb-2 truncate">
                {image.originalFilename}
              </h3>

              <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                <div className="flex items-center gap-1">
                  <MessageCircle className="h-4 w-4" />
                  <span>{image.annotationCount} annotations</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(image.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleViewImage(image.id)}
                  className="flex items-center justify-center gap-2 flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                >
                  <Eye className="h-4 w-4" />
                  View
                </button>
                <button
                  onClick={() => handleAnnotateImage(image.id)}
                  className="flex items-center justify-center gap-2 flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Edit className="h-4 w-4" />
                  Annotate
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
