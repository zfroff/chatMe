import { useState, useEffect, useRef } from "react";
import { getAuth } from "firebase/auth";
import { chatService } from "../services/chat";

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
}

interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: Message;
  updatedAt: number;
}

export function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatUserId, setNewChatUserId] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const auth = getAuth();
  const currentUser = auth.currentUser;

  useEffect(() => {
    loadConversations();

    // Listen for new messages
    chatService.onNewMessage((message) => {
      setMessages((prev) => [...prev, message]);
      scrollToBottom();
    });

    return () => {
      chatService.disconnect();
    };
  }, []);

  useEffect(() => {
    if (currentConversation) {
      fetchMessages(currentConversation.id);
    }
  }, [currentConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadConversations = async () => {
    try {
      setLoading(true);
      setError("");
      const conversations = await chatService.getConversations();
      setConversations(conversations);
    } catch (error) {
      console.error("Error loading conversations:", error);
      setError(
        "Failed to load conversations. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    setIsLoadingMessages(true);
    try {
      setError("");
      const messages = await chatService.getMessages(conversationId);
      setMessages(messages);
    } catch (error) {
      console.error("Error loading messages:", error);
      setError("Failed to load messages");
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentConversation) return;

    try {
      setError("");
      await chatService.sendMessage(currentConversation.id, newMessage.trim());
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      setError("Failed to send message");
    }
  };

  const handleStartNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatUserId.trim()) return;

    try {
      setError("");
      setLoading(true);

      const conversation = await chatService.startConversation(
        newChatUserId.trim()
      );
      setConversations((prev) => [conversation, ...prev]);
      setCurrentConversation(conversation);
      setShowNewChat(false);
      setNewChatUserId("");
    } catch (error) {
      console.error("Error starting conversation:", error);
      setError(
        "Failed to start conversation. Please check the user ID and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950 text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">
            Please sign in to access the chat
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-950">
      {/* Sidebar */}
      <div className="w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Chats</h2>
          <button
            onClick={() => setShowNewChat(true)}
            className="p-2 rounded-lg bg-orange-500 hover:bg-orange-600 transition-colors text-white"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>

        {/* New Chat Dialog */}
        {showNewChat && (
          <div className="p-4 border-b border-zinc-800 bg-zinc-800/50">
            <form onSubmit={handleStartNewChat} className="space-y-2">
              <input
                type="text"
                value={newChatUserId}
                onChange={(e) => setNewChatUserId(e.target.value)}
                placeholder="Enter user ID"
                className="w-full px-3 py-2 bg-zinc-700 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-white transition-colors"
                >
                  Start Chat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewChat(false);
                    setNewChatUserId("");
                  }}
                  className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="overflow-y-auto flex-1">
          {loading && conversations.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin h-8 w-8 border-4 border-orange-500 rounded-full border-t-transparent"></div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex items-center justify-center h-full text-zinc-500 p-4 text-center">
              No conversations yet. Start a new chat to begin messaging.
            </div>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                className={`w-full p-4 text-left hover:bg-zinc-800 transition-colors ${
                  currentConversation?.id === conversation.id
                    ? "bg-zinc-800"
                    : ""
                } border-b border-zinc-800/50`}
                onClick={() => setCurrentConversation(conversation)}
              >
                <div className="font-medium text-white">
                  {conversation.participants
                    .filter((id) => id !== currentUser?.uid)
                    .join(", ")}
                </div>
                {conversation.lastMessage && (
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm text-zinc-400 truncate flex-1">
                      {conversation.lastMessage.text}
                    </p>
                    <span className="text-xs text-zinc-500 ml-2">
                      {formatTimestamp(conversation.lastMessage.timestamp)}
                    </span>
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            {currentUser.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName || ""}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-medium">
                {(currentUser.displayName || "U")[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white truncate">
                {currentUser.displayName || "Anonymous"}
              </div>
              <div className="text-sm text-zinc-400 truncate">
                {currentUser.email || currentUser.phoneNumber}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-zinc-800 bg-zinc-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-medium">
                {currentConversation.participants
                  .filter((id) => id !== currentUser?.uid)[0][0]
                  .toUpperCase()}
              </div>
              <h3 className="text-lg font-semibold text-white">
                {currentConversation.participants
                  .filter((id) => id !== currentUser?.uid)
                  .join(", ")}
              </h3>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoadingMessages ? (
                <div className="flex justify-center items-center h-full">
                  <span className="loading loading-spinner"></span>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.senderId === currentUser?.uid
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[70%] p-3 rounded-2xl ${
                        message.senderId === currentUser?.uid
                          ? "bg-orange-500 text-white"
                          : "bg-zinc-800 text-white"
                      }`}
                    >
                      <p className="break-words">{message.text}</p>
                      <span className="text-xs opacity-75 mt-1 block">
                        {formatTimestamp(message.timestamp)}
                      </span>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form
              onSubmit={handleSendMessage}
              className="p-4 border-t border-zinc-800 bg-zinc-900"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-zinc-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-zinc-400"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="px-6 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500 bg-gradient-to-br from-zinc-900 to-zinc-950">
            <div className="text-center max-w-md px-4">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-zinc-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <h3 className="text-xl font-semibold mb-2">Welcome to Chat</h3>
              <p className="text-zinc-400">
                Select a conversation from the sidebar or start a new chat to
                begin messaging
              </p>
              <button
                onClick={() => setShowNewChat(true)}
                className="mt-4 px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl text-white transition-colors inline-flex items-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Start New Chat
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg animate-fade-in">
          {error}
        </div>
      )}
    </div>
  );
}
