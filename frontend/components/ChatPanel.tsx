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
    } catch (error) {
      console.error("Failed to load messages:", error);
      toast({
        title: "Failed to load messages",
        description: "Could not load chat messages.",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const message = await backend.annotation.addChatMessage({
        annotationId,
        message: newMessage.trim(),
      });

      setMessages([...messages, message]);
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
      toast({
        title: "Failed to send message",
        description: "Could not send the message. Please try again.",
        variant: "destructive",
      });
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
            placeholder="Type a message..."
            disabled={isLoading}
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
      </form>
    </div>
  );
}
