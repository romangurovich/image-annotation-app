import { api, APIError, Header, Query } from "encore.dev/api";
import { annotationDB } from "./db";
import { generalLimiter, getClientIP } from "./rate_limiter";

export interface ListChatMessagesParams {
  annotationId: string;
  shareToken?: Query<string>;
  xForwardedFor?: Header<"X-Forwarded-For">;
  xRealIP?: Header<"X-Real-IP">;
  cfConnectingIP?: Header<"CF-Connecting-IP">;
}

export interface ListChatMessagesResponse {
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  annotationId: string;
  message: string;
  userIP: string;
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

    // Check if user has access to this annotation's image
    const annotationData = await annotationDB.queryRow<{
      image_id: string;
      user_ip: string;
    }>`
      SELECT a.image_id, i.user_ip
      FROM annotations a
      JOIN images i ON a.image_id = i.id
      WHERE a.id = ${params.annotationId}
    `;
    
    if (!annotationData) {
      throw APIError.notFound("Annotation not found");
    }

    let hasAccess = annotationData.user_ip === clientIP;

    // If share token is provided, verify it
    if (params.shareToken) {
      const shareRecord = await annotationDB.queryRow<{ id: string }>`
        SELECT id FROM image_shares
        WHERE image_id = ${annotationData.image_id} AND share_token = ${params.shareToken}
      `;
      
      if (shareRecord) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      throw APIError.permissionDenied("Access denied");
    }

    const messages: ChatMessage[] = [];
    
    for await (const row of annotationDB.query<{
      id: string;
      annotation_id: string;
      message: string;
      user_ip: string;
      created_at: Date;
    }>`
      SELECT id, annotation_id, message, user_ip, created_at
      FROM chat_messages
      WHERE annotation_id = ${params.annotationId}
      ORDER BY created_at ASC
    `) {
      messages.push({
        id: row.id,
        annotationId: row.annotation_id,
        message: row.message,
        userIP: row.user_ip,
        createdAt: row.created_at,
      });
    }
    
    return { messages };
  }
);
