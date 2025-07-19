import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import backend from "~backend/client";
import { useToast } from "@/components/ui/use-toast";
import type { ChatMessage } from "~backend/annotation/list_chat_messages";

interface ChatPanelProps {
  annotationId: number;
}

export function ChatPanel({ annotationId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadMessages();
  }, [annotationId]);

  const loadMessages = async () => {
    try {
      const response = await backend.annotation.listChatMessages({ annotationId });
      setMessages(response.messages);
    } catch (error: any) {
      console.error("Failed to load messages:", error);
      
      if (error?.code === "resource_exhausted") {
        toast({
          title: "Rate limit exceeded",
          description: error.message || "Too many requests. Please wait before trying again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to load messages",
          description: "Could not load chat messages.",
          variant: "destructive",
        });
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isLoading) return;

    // Validate message length on frontend
    if (newMessage.length > 1000) {
      toast({
        title: "Message too long",
        description: "Messages must be 1000 characters or less.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const message = await backend.annotation.addChatMessage({
        annotationId,
        message: newMessage.trim(),
      });

      setMessages([...messages, message]);
      setNewMessage("");
    } catch (error: any) {
      console.error("Failed to send message:", error);
      
      if (error?.code === "resource_exhausted") {
        toast({
          title: "Rate limit exceeded",
          description: error.message || "Too many messages. Please wait before sending another.",
          variant: "destructive",
        });
      } else if (error?.code === "invalid_argument") {
        toast({
          title: "Invalid message",
          description: error.message || "Please check your message and try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to send message",
          description: "Could not send the message. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-96">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 text-sm">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-900">{message.message}</p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(message.createdAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSendMessage} className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message... (max 1000 chars)"
            disabled={isLoading}
            maxLength={1000}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isLoading}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {newMessage.length}/1000 characters
        </div>
      </form>
    </div>
  );
}
