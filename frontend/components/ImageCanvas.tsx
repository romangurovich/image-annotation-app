import { useEffect, useRef, useState, useCallback } from "react";
import { MessageCircle, X, Share2 } from "lucide-react";
import backend from "~backend/client";
import { useToast } from "@/components/ui/use-toast";
import { ChatPanel } from "./ChatPanel";
import type { Annotation } from "~backend/annotation/list_annotations";

interface ImageCanvasProps {
  imageId: string;
  shareToken?: string | null;
}

export function ImageCanvas({ imageId, shareToken }: ImageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnotation, setSelectedAnnotation] =
    useState<Annotation | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const { toast } = useToast();

  const loadImage = useCallback(async () => {
    try {
      const params: { id: string; shareToken?: string } = { id: imageId };
      if (shareToken) {
        params.shareToken = shareToken;
      }

      const response = await backend.annotation.getImage(params);
      setImageUrl(response.imageUrl);
      setCanEdit(response.canEdit);
    } catch (error: unknown) {
      const apiError = error as { code?: string; message?: string };
      console.error("Failed to load image:", error);

      if (apiError?.code === "permission_denied") {
        toast({
          title: "Access denied",
          description: "You don't have permission to view this image.",
          variant: "destructive",
        });
      } else if (apiError?.code === "resource_exhausted") {
        toast({
          title: "Rate limit exceeded",
          description:
            apiError.message ||
            "Too many requests. Please wait before trying again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to load image",
          description: "Could not load the image. Please try again.",
          variant: "destructive",
        });
      }
    }
  }, [imageId, shareToken, toast]);

  const loadAnnotations = useCallback(async () => {
    try {
      const params: { imageId: string; shareToken?: string } = { imageId };
      if (shareToken) {
        params.shareToken = shareToken;
      }

      const response = await backend.annotation.listAnnotations(params);
      setAnnotations(response.annotations);
    } catch (error: unknown) {
      const apiError = error as { code?: string; message?: string };
      console.error("Failed to load annotations:", error);

      if (apiError?.code === "permission_denied") {
        // Don't show error for annotations if user doesn't have access
        return;
      } else if (apiError?.code === "resource_exhausted") {
        toast({
          title: "Rate limit exceeded",
          description:
            apiError.message ||
            "Too many requests. Please wait before trying again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to load annotations",
          description: "Could not load existing annotations.",
          variant: "destructive",
        });
      }
    }
  }, [imageId, shareToken, toast]);

  useEffect(() => {
    loadImage();
    loadAnnotations();
  }, [loadImage, loadAnnotations]);

  const copyToClipboard = async (text: string) => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);

        if (successful) {
          return true;
        } else {
          throw new Error("Copy command failed");
        }
      }
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      return false;
    }
  };

  const createShareLink = async () => {
    try {
      const response = await backend.annotation.createShareLink({ imageId });

      // Try to copy to clipboard
      const copied = await copyToClipboard(response.shareUrl);

      if (copied) {
        toast({
          title: "Share link created",
          description: "Link copied to clipboard!",
        });
      } else {
        toast({
          title: "Share link created",
          description: `Link: ${response.shareUrl}`,
        });
      }
    } catch (error: unknown) {
      const apiError = error as { code?: string; message?: string };
      console.error("Failed to create share link:", error);

      if (apiError?.code === "permission_denied") {
        toast({
          title: "Permission denied",
          description: "Only the image owner can create share links.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to create share link",
          description: "Could not create share link. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current || !imageLoaded) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the original image
    ctx.drawImage(imageRef.current, 0, 0);

    // Draw existing annotations
    annotations.forEach((annotation) => {
      ctx.beginPath();
      ctx.arc(annotation.x, annotation.y, annotation.radius, 0, 2 * Math.PI);
      ctx.strokeStyle =
        selectedAnnotation?.id === annotation.id ? "#ef4444" : "#3b82f6";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle =
        selectedAnnotation?.id === annotation.id
          ? "rgba(239, 68, 68, 0.1)"
          : "rgba(59, 130, 246, 0.1)";
      ctx.fill();
    });
  }, [imageLoaded, annotations, selectedAnnotation]);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) return;

    const img = new window.Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (imageUrl) {
      setupCanvas();
    }
  }, [imageUrl, setupCanvas]);

  useEffect(() => {
    if (imageLoaded) {
      drawCanvas();
    }
  }, [imageLoaded, drawCanvas]);

  const getCanvasCoordinates = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(event);

    // Check if clicking on existing annotation
    const clickedAnnotation = annotations.find((annotation) => {
      const distance = Math.sqrt(
        Math.pow(coords.x - annotation.x, 2) +
          Math.pow(coords.y - annotation.y, 2)
      );
      return distance <= annotation.radius;
    });

    if (clickedAnnotation) {
      setSelectedAnnotation(clickedAnnotation);
    } else {
      setSelectedAnnotation(null);
    }
  };

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <div className="bg-white rounded-lg shadow-lg p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-blue-600" />
              <span className="text-sm text-gray-600">
                Click on annotation circles to view chat messages.
              </span>
            </div>
            {canEdit && !shareToken && (
              <button
                onClick={createShareLink}
                className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
            )}
          </div>
          {shareToken && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                You&apos;re viewing a shared image. You can comment on
                annotations but cannot create new ones.
              </p>
            </div>
          )}
          <div className="border rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              className="max-w-full h-auto cursor-pointer"
              style={{ display: "block" }}
            />
          </div>
        </div>
      </div>

      {selectedAnnotation && (
        <div className="w-80">
          <div className="bg-white rounded-lg shadow-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">Annotation Chat</h3>
              <button
                onClick={() => setSelectedAnnotation(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ChatPanel
              annotationId={selectedAnnotation.id}
              shareToken={shareToken}
            />
          </div>
        </div>
      )}
    </div>
  );
}
