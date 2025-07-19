import { api } from "encore.dev/api";
import { annotationDB } from "./db";

export interface ListChatMessagesParams {
  annotationId: number;
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
