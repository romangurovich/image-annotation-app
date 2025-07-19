import { api, APIError, Header } from "encore.dev/api";
import { annotationDB } from "./db";
import { generalLimiter, getClientIP } from "./rate_limiter";

export interface ListChatMessagesParams {
  annotationId: number;
  xForwardedFor?: Header<"X-Forwarded-For">;
  xRealIP?: Header<"X-Real-IP">;
  cfConnectingIP?: Header<"CF-Connecting-IP">;
}

export interface ListChatMessagesResponse {
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: number;
  annotationId: number;
  message: string;
  createdAt: Date;
}

// Retrieves all chat messages for an annotation.
export const listChatMessages = api<ListChatMessagesParams, ListChatMessagesResponse>(
  { expose: true, method: "GET", path: "/annotations/:annotationId/messages" },
  async (params) => {
    // Rate limiting
    const clientIP = getClientIP({
      'x-forwarded-for': params.xForwardedFor,
      'x-real-ip': params.xRealIP,
      'cf-connecting-ip': params.cfConnectingIP,
    });
    
    const rateLimitResult = generalLimiter.checkLimit(clientIP);
    if (!rateLimitResult.allowed) {
      const resetTimeSeconds = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
      throw APIError.resourceExhausted(`Rate limit exceeded. Try again in ${resetTimeSeconds} seconds.`);
    }

    const messages: ChatMessage[] = [];
    
    for await (const row of annotationDB.query<{
      id: number;
      annotation_id: number;
      message: string;
      created_at: Date;
    }>`
      SELECT id, annotation_id, message, created_at
      FROM chat_messages
      WHERE annotation_id = ${params.annotationId}
      ORDER BY created_at ASC
    `) {
      messages.push({
        id: row.id,
        annotationId: row.annotation_id,
        message: row.message,
        createdAt: row.created_at,
      });
    }
    
    return { messages };
  }
);
