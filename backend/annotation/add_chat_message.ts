import { api, APIError, Header, Query } from "encore.dev/api";
import { annotationDB } from "./db";
import { chatLimiter, getClientIP } from "./rate_limiter";

export interface AddChatMessageRequest {
  annotationId: string;
  message: string;
  shareToken?: Query<string>;
  xForwardedFor?: Header<"X-Forwarded-For">;
  xRealIP?: Header<"X-Real-IP">;
  cfConnectingIP?: Header<"CF-Connecting-IP">;
}

export interface ChatMessage {
  id: string;
  annotationId: string;
  message: string;
  userIP: string;
  createdAt: Date;
}

// Adds a chat message to an annotation.
export const addChatMessage = api<AddChatMessageRequest, ChatMessage>(
  { expose: true, method: "POST", path: "/annotations/:annotationId/messages" },
  async (req) => {
    // Rate limiting
    const clientIP = getClientIP({
      "x-forwarded-for": req.xForwardedFor,
      "x-real-ip": req.xRealIP,
      "cf-connecting-ip": req.cfConnectingIP,
    });

    const rateLimitResult = chatLimiter.checkLimit(clientIP);
    if (!rateLimitResult.allowed) {
      const resetTimeSeconds = Math.ceil(
        (rateLimitResult.resetTime - Date.now()) / 1000
      );
      throw APIError.resourceExhausted(
        `Chat rate limit exceeded. Try again in ${resetTimeSeconds} seconds.`
      );
    }

    // Validate message length
    if (req.message.length > 1000) {
      throw APIError.invalidArgument(
        "Message too long. Maximum 1000 characters allowed."
      );
    }

    if (req.message.trim().length === 0) {
      throw APIError.invalidArgument("Message cannot be empty.");
    }

    // Check if user has access to this annotation's image
    const annotationData = await annotationDB.queryRow<{
      image_id: string;
      user_ip: string;
    }>`
      SELECT a.image_id, i.user_ip
      FROM annotations a
      JOIN images i ON a.image_id = i.id
      WHERE a.id = ${req.annotationId}
    `;

    if (!annotationData) {
      throw APIError.notFound("Annotation not found");
    }

    let hasAccess = annotationData.user_ip === clientIP;

    // If share token is provided, verify it
    if (req.shareToken) {
      const shareRecord = await annotationDB.queryRow<{ id: string }>`
        SELECT id FROM image_shares
        WHERE image_id = ${annotationData.image_id} AND share_token = ${req.shareToken}
      `;

      if (shareRecord) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      throw APIError.permissionDenied("Access denied");
    }

    const result = await annotationDB.queryRow<{
      id: string;
      created_at: Date;
    }>`
      INSERT INTO chat_messages (annotation_id, message, user_ip)
      VALUES (${req.annotationId}, ${req.message}, ${clientIP})
      RETURNING id, created_at
    `;

    if (!result) {
      throw new Error("Failed to add chat message");
    }

    return {
      id: result.id,
      annotationId: req.annotationId,
      message: req.message,
      userIP: clientIP,
      createdAt: result.created_at,
    };
  }
);
