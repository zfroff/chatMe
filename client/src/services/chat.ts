import { io } from "socket.io-client";
import { getAuth } from "firebase/auth";

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

class ChatService {
  private auth = getAuth();
  private socket = io("http://localhost:3000", {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    auth: {
      token: () => localStorage.getItem("token"),
    },
  });

  constructor() {
    this.initializeSocket();
  }

  private initializeSocket() {
    this.socket.connect();

    this.socket.on("connect", () => {
      console.log("Connected to chat server");
    });

    this.socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
    });
  }

  public startConversation(participantId: string): Promise<Conversation> {
    return new Promise((resolve, reject) => {
      if (!this.socket.connected) {
        reject(new Error("Not connected to chat server"));
        return;
      }

      this.socket.emit(
        "start_conversation",
        { participantId },
        (response: {
          success: boolean;
          data?: Conversation;
          error?: string;
        }) => {
          if (response.success && response.data) {
            resolve(response.data);
          } else {
            reject(new Error(response.error || "Failed to start conversation"));
          }
        }
      );
    });
  }

  public sendMessage(conversationId: string, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket.connected) {
        reject(new Error("Not connected to chat server"));
        return;
      }

      this.socket.emit(
        "send_message",
        {
          conversationId,
          text,
        },
        (response: { success: boolean; error?: string }) => {
          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error || "Failed to send message"));
          }
        }
      );
    });
  }

  public onNewMessage(callback: (message: Message) => void) {
    this.socket.on("new_message", callback);
  }

  public getConversations(): Promise<Conversation[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket.connected) {
        reject(new Error("Not connected to chat server"));
        return;
      }

      this.socket.emit(
        "get_conversations",
        (response: {
          success: boolean;
          data?: Conversation[];
          error?: string;
        }) => {
          if (response.success && response.data) {
            resolve(response.data);
          } else {
            reject(new Error(response.error || "Failed to get conversations"));
          }
        }
      );
    });
  }

  public getMessages(conversationId: string): Promise<Message[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket.connected) {
        reject(new Error("Not connected to chat server"));
        return;
      }

      this.socket.emit(
        "get_messages",
        { conversationId },
        (response: { success: boolean; data?: Message[]; error?: string }) => {
          if (response.success && response.data) {
            resolve(response.data);
          } else {
            reject(new Error(response.error || "Failed to get messages"));
          }
        }
      );
    });
  }

  public disconnect() {
    this.socket.disconnect();
  }
}

export const chatService = new ChatService();
