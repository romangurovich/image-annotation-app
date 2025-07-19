import { api } from "encore.dev/api";
import { annotationDB } from "./db";

export interface AddChatMessageRequest {
  annotationId: number;
  message: string;
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
