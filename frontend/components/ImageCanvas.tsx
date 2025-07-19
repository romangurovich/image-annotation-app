import { useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import backend from "~backend/client";
import { useToast } from "@/components/ui/use-toast";
import { ChatPanel } from "./ChatPanel";
import type { Annotation } from "~backend/annotation/list_annotations";

interface ImageCanvasProps {
  imageId: number;
}

export function ImageCanvas({ imageId }: ImageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentRadius, setCurrentRadius] = useState<number>(0);
  const { toast } = useToast();

  useEffect(() => {
    loadImage();
    loadAnnotations();
  }, [imageId]);

  const loadImage = async () => {
    try {
      const response = await backend.annotation.getImage({ id: imageId });
      setImageUrl(response.imageUrl);
    } catch (error) {
      console.error("Failed to load image:", error);
      toast({
        title: "Failed to load image",
        description: "Could not load the image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const loadAnnotations = async () => {
    try {
      const response = await backend.annotation.listAnnotations({ imageId });
      setAnnotations(response.annotations);
    } catch (error) {
      console.error("Failed to load annotations:", error);
      toast({
        title: "Failed to load annotations",
        description: "Could not load existing annotations.",
        variant: "destructive",
      });
    }
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) return;

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
      ctx.strokeStyle = selectedAnnotation?.id === annotation.id ? "#ef4444" : "#3b82f6";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = selectedAnnotation?.id === annotation.id ? "rgba(239, 68, 68, 0.1)" : "rgba(59, 130, 246, 0.1)";
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
  };

  const setupCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      imageRef.current = img;
      drawCanvas();
    };
    img.src = imageUrl;
  };

  useEffect(() => {
    if (imageUrl) {
      setupCanvas();
    }
  }, [imageUrl]);

  useEffect(() => {
    drawCanvas();
  }, [annotations, selectedAnnotation, isDrawing, startPoint, currentRadius]);

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
        Math.pow(coords.x - annotation.x, 2) + Math.pow(coords.y - annotation.y, 2)
      );
      return distance <= annotation.radius;
    });

    if (clickedAnnotation) {
      setSelectedAnnotation(clickedAnnotation);
    } else {
      setSelectedAnnotation(null);
      setIsDrawing(true);
      setStartPoint(coords);
      setCurrentRadius(0);
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint) return;

    const coords = getCanvasCoordinates(event);
    const radius = Math.sqrt(
      Math.pow(coords.x - startPoint.x, 2) + Math.pow(coords.y - startPoint.y, 2)
    );

    setCurrentRadius(radius);
  };

  const handleMouseUp = async (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint) return;

    const coords = getCanvasCoordinates(event);
    const radius = Math.sqrt(
      Math.pow(coords.x - startPoint.x, 2) + Math.pow(coords.y - startPoint.y, 2)
    );

    if (radius > 10) { // Minimum radius
      try {
        const newAnnotation = await backend.annotation.createAnnotation({
          imageId,
          x: startPoint.x,
          y: startPoint.y,
          radius,
        });

        setAnnotations([...annotations, newAnnotation]);
        toast({
          title: "Annotation created",
          description: "Click on the circle to start a chat thread.",
        });
      } catch (error) {
        console.error("Failed to create annotation:", error);
        toast({
          title: "Failed to create annotation",
          description: "Could not create the annotation. Please try again.",
          variant: "destructive",
        });
      }
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentRadius(0);
  };

  const handleMouseLeave = () => {
    if (isDrawing) {
      setIsDrawing(false);
      setStartPoint(null);
      setCurrentRadius(0);
    }
  };

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <div className="bg-white rounded-lg shadow-lg p-4">
          <div className="mb-4 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-blue-600" />
            <span className="text-sm text-gray-600">
              Click and drag to create annotation circles. Click on circles to open chat.
            </span>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              className="max-w-full h-auto cursor-crosshair"
              style={{ display: "block" }}
            />
          </div>
        </div>
      </div>

      {selectedAnnotation && (
        <div className="w-80">
          <div className="bg-white rounded-lg shadow-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">
                Annotation Chat
              </h3>
              <button
                onClick={() => setSelectedAnnotation(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ChatPanel annotationId={selectedAnnotation.id} />
          </div>
        </div>
      )}
    </div>
  );
}
