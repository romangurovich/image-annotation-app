import { api, APIError, Header } from "encore.dev/api";
import { annotationDB } from "./db";
import { chatLimiter, getClientIP } from "./rate_limiter";

export interface AddChatMessageRequest {
  annotationId: number;
  message: string;
  xForwardedFor?: Header<"X-Forwarded-For">;
  xRealIP?: Header<"X-Real-IP">;
  cfConnectingIP?: Header<"CF-Connecting-IP">;
}

export interface ChatMessage {
  id: number;
  annotationId: number;
  message: string;
  createdAt: Date;
}

// Adds a chat message to an annotation.
export const addChatMessage = api<AddChatMessageRequest, ChatMessage>(
  { expose: true, method: "POST", path: "/annotations/:annotationId/messages" },
  async (req) => {
    // Rate limiting
    const clientIP = getClientIP({
      'x-forwarded-for': req.xForwardedFor,
      'x-real-ip': req.xRealIP,
      'cf-connecting-ip': req.cfConnectingIP,
    });
    
    const rateLimitResult = chatLimiter.checkLimit(clientIP);
    if (!rateLimitResult.allowed) {
      const resetTimeSeconds = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
      throw APIError.resourceExhausted(`Chat rate limit exceeded. Try again in ${resetTimeSeconds} seconds.`);
    }

    // Validate message length
    if (req.message.length > 1000) {
      throw APIError.invalidArgument("Message too long. Maximum 1000 characters allowed.");
    }

    if (req.message.trim().length === 0) {
      throw APIError.invalidArgument("Message cannot be empty.");
    }

    const result = await annotationDB.queryRow<{
      id: number;
      created_at: Date;
    }>`
      INSERT INTO chat_messages (annotation_id, message)
      VALUES (${req.annotationId}, ${req.message})
      RETURNING id, created_at
    `;
    
    if (!result) {
      throw new Error("Failed to add chat message");
    }
    
    return {
      id: result.id,
      annotationId: req.annotationId,
      message: req.message,
      createdAt: result.created_at,
    };
  }
);
