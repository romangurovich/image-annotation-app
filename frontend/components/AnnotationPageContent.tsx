import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { AnnotationScreen } from "./AnnotationScreen";

export function AnnotationPageContent() {
  const { imageId } = useParams<{ imageId: string }>();
  const [shareToken, setShareToken] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("share");
    if (token) {
      setShareToken(token);
    }
  }, []);

  if (!imageId) {
    return <Navigate to="/" replace />;
  }

  return <AnnotationScreen imageId={imageId} shareToken={shareToken} />;
}
