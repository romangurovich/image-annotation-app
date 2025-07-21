import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X, Share2, Home, Images } from "lucide-react";
import { useNavigate } from "react-router-dom";
import backend from "~backend/client";
import { useToast } from "@/components/ui/use-toast";
import { ChatPanel } from "./ChatPanel";
import type { Annotation } from "~backend/annotation/list_annotations";

interface AnnotationScreenProps {
  imageId: string;
  shareToken?: string | null;
}

interface ImageData {
  imageUrl: string;
  canEdit: boolean;
  originalFilename: string;
}

interface ApiError {
  code?: string;
  message?: string;
}

export function AnnotationScreen({
  imageId,
  shareToken,
}: AnnotationScreenProps) {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnotation, setSelectedAnnotation] =
    useState<Annotation | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null
  );
  const [currentRadius, setCurrentRadius] = useState<number>(0);
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
      setImageData(response);
    } catch (error: unknown) {
      const apiError = error as ApiError;

      if (apiError?.code === "permission_denied") {
        toast({
          title: "Access denied",
          description: "You don&apos;t have permission to view this image.",
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
      const apiError = error as ApiError;

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

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      // Try modern clipboard API first
      if (
        typeof window !== "undefined" &&
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        window.isSecureContext
      ) {
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
      return false;
    }
  }, []);

  const createShareLink = useCallback(async () => {
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
      const apiError = error as ApiError;

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
  }, [imageId, copyToClipboard, toast]);

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

    // Draw current drawing circle if in drawing mode
    if (isDrawing && startPoint && currentRadius > 0) {
      ctx.beginPath();
      ctx.arc(startPoint.x, startPoint.y, currentRadius, 0, 2 * Math.PI);
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "rgba(16, 185, 129, 0.1)";
      ctx.fill();
    }
  }, [
    imageLoaded,
    annotations,
    selectedAnnotation,
    isDrawing,
    startPoint,
    currentRadius,
  ]);

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
    loadImage();
    loadAnnotations();
  }, [loadImage, loadAnnotations]);

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

  const getCanvasCoordinates = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
      };
    },
    []
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
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
        if (canEdit) {
          setIsDrawing(true);
          setStartPoint(coords);
          setCurrentRadius(0);
        }
      }
    },
    [annotations, canEdit, getCanvasCoordinates]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !startPoint || !canEdit) return;

      const coords = getCanvasCoordinates(event);
      const radius = Math.sqrt(
        Math.pow(coords.x - startPoint.x, 2) +
          Math.pow(coords.y - startPoint.y, 2)
      );

      setCurrentRadius(radius);
    },
    [isDrawing, startPoint, canEdit, getCanvasCoordinates]
  );

  const handleMouseUp = useCallback(
    async (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !startPoint || !canEdit) return;

      const coords = getCanvasCoordinates(event);
      const radius = Math.sqrt(
        Math.pow(coords.x - startPoint.x, 2) +
          Math.pow(coords.y - startPoint.y, 2)
      );

      if (radius > 10) {
        // Minimum radius
        try {
          const params: {
            imageId: string;
            x: number;
            y: number;
            radius: number;
            shareToken?: string;
          } = {
            imageId,
            x: startPoint.x,
            y: startPoint.y,
            radius,
          };
          if (shareToken) {
            params.shareToken = shareToken;
          }

          const newAnnotation =
            await backend.annotation.createAnnotation(params);

          setAnnotations((prev) => [...prev, newAnnotation]);
          toast({
            title: "Annotation created",
            description: "Click on the circle to start a chat thread.",
          });
        } catch (error: unknown) {
          const apiError = error as ApiError;

          if (apiError?.code === "permission_denied") {
            toast({
              title: "Permission denied",
              description:
                "You don&apos;t have permission to create annotations.",
              variant: "destructive",
            });
          } else if (apiError?.code === "resource_exhausted") {
            toast({
              title: "Rate limit exceeded",
              description:
                apiError.message ||
                "Too many annotations. Please wait before creating another.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Failed to create annotation",
              description: "Could not create the annotation. Please try again.",
              variant: "destructive",
            });
          }
        }
      }

      setIsDrawing(false);
      setStartPoint(null);
      setCurrentRadius(0);
    },
    [
      isDrawing,
      startPoint,
      canEdit,
      imageId,
      shareToken,
      getCanvasCoordinates,
      toast,
    ]
  );

  const handleMouseLeave = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      setStartPoint(null);
      setCurrentRadius(0);
    }
  }, [isDrawing]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/")}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Home className="h-4 w-4" />
                Home
              </button>
              <button
                onClick={() => navigate("/my-images")}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Images className="h-4 w-4" />
                My Images
              </button>
            </div>

            <div className="flex items-center gap-4">
              {imageData && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">
                    {imageData.originalFilename}
                  </span>
                  <span className="mx-2">•</span>
                  <span>{annotations.length} annotations</span>
                </div>
              )}

              {canEdit && !shareToken && (
                <button
                  onClick={createShareLink}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {shareToken && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Shared Image:</strong> You&apos;re viewing a shared image.
              You can comment on annotations but cannot create new ones.
            </p>
          </div>
        )}

        <div className="flex gap-6 h-[calc(100vh-200px)]">
          {/* Image Canvas */}
          <div className="flex-1 bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-blue-600" />
                <span className="text-sm text-gray-700 font-medium">
                  {canEdit
                    ? "Click and drag to create annotation circles. Click on circles to open chat."
                    : "Click on circles to view chat messages."}
                </span>
              </div>
            </div>

            <div className="p-4 h-full overflow-auto">
              <div className="flex justify-center">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                  className={`max-w-full max-h-full border rounded-lg shadow-sm ${
                    canEdit ? "cursor-crosshair" : "cursor-pointer"
                  }`}
                  style={{ display: "block" }}
                />
              </div>
            </div>
          </div>

          {/* Chat Panel */}
          {selectedAnnotation ? (
            <div className="w-96 bg-white rounded-lg shadow-lg">
              <div className="flex items-center justify-between p-4 border-b bg-gray-50">
                <h3 className="font-semibold text-gray-900">Annotation Chat</h3>
                <button
                  onClick={() => setSelectedAnnotation(null)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ChatPanel
                annotationId={selectedAnnotation.id}
                shareToken={shareToken}
              />
            </div>
          ) : (
            <div className="w-96 bg-white rounded-lg shadow-lg flex items-center justify-center">
              <div className="text-center text-gray-500 p-8">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <h3 className="font-medium text-gray-700 mb-2">
                  No annotation selected
                </h3>
                <p className="text-sm">
                  {canEdit
                    ? "Create a new annotation or click on an existing one to start chatting."
                    : "Click on an annotation circle to view the conversation."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
