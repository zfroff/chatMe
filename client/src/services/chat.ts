import io from "socket.io-client";

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

// Define types for socket.io events
// These interfaces are used for documentation purposes
// @ts-ignore - used for documentation
interface ServerToClientEvents {
  connect: () => void;
  disconnect: (reason: string) => void;
  connect_error: (error: Error) => void;
  reconnect: (attemptNumber: number) => void;
  reconnect_error: (error: Error) => void;
  reconnect_failed: () => void;
  new_message: (message: Message) => void;
}

// @ts-ignore - used for documentation
interface ClientToServerEvents {
  start_conversation: (
    data: { participantId: string },
    callback: (response: {
      success: boolean;
      data?: Conversation;
      error?: string;
    }) => void
  ) => void;
  send_message: (
    data: { conversationId: string; text: string },
    callback: (response: { success: boolean; error?: string }) => void
  ) => void;
  get_conversations: (
    callback: (response: {
      success: boolean;
      data?: Conversation[];
      error?: string;
    }) => void
  ) => void;
  get_messages: (
    data: { conversationId: string },
    callback: (response: {
      success: boolean;
      data?: Message[];
      error?: string;
    }) => void
  ) => void;
}

class ChatService {
  // Use any for socket type to avoid TypeScript errors with mismatched versions
  private socket: any;
  private messageQueue: { conversationId: string; text: string }[] = [];

  constructor() {
    // Create the socket directly using io instead of Manager
    this.socket = io(import.meta.env.VITE_API_URL || "http://localhost:3000", {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true,
      transports: ['polling', 'websocket'], // Try polling first, then websocket
      auth: {
        token: localStorage.getItem("token") || "",
      },
    });

    this.initializeSocket();
  }

  public sendMessage(
    conversationId: string,
    text: string,
    retryCount = 3
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket.connected) {
        if (retryCount > 0) {
          console.log(
            `Socket not connected. Retrying... (${retryCount} attempts left)`
          );
          // Wait a bit and retry
          setTimeout(() => {
            this.sendMessage(conversationId, text, retryCount - 1)
              .then(resolve)
              .catch(reject);
          }, 1000);
          return;
        } else {
          // Queue the message for later sending
          this.messageQueue.push({ conversationId, text });
          console.log("Message queued for later sending");
          resolve(); // Resolve anyway to not block the UI
          return;
        }
      }

      // Try to send any queued messages first
      this.processMessageQueue();

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

  private processMessageQueue(): void {
    if (this.messageQueue.length > 0 && this.socket.connected) {
      console.log(
        `Processing message queue (${this.messageQueue.length} messages)`
      );

      // Process up to 5 messages at a time to avoid flooding
      const messagesToProcess = this.messageQueue.splice(0, 5);

      messagesToProcess.forEach(({ conversationId, text }) => {
        this.socket.emit(
          "send_message",
          {
            conversationId,
            text,
          },
          (response: { success: boolean; error?: string }) => {
            if (!response.success) {
              console.error("Failed to send queued message:", response.error);
              // Put the message back in the queue
              this.messageQueue.push({ conversationId, text });
            }
          }
        );
      });
    }
  }

  private initializeSocket() {
    this.socket.connect();

    this.socket.on("connect", () => {
      console.log("Connected to chat server");
      // Process any queued messages when connection is established
      this.processMessageQueue();
    });

    this.socket.on("connect_error", (error: Error) => {
      console.error("Connection error:", error);
      // Implement exponential backoff by using the built-in socket.io reconnection
    });

    this.socket.on("disconnect", (reason: string) => {
      console.log(`Disconnected: ${reason}`);

      // If the server disconnected us, try to reconnect
      if (reason === "io server disconnect") {
        this.socket.connect();
      }
      // For all other cases, socket.io will automatically try to reconnect
    });

    this.socket.on("reconnect", (attemptNumber: number) => {
      console.log(`Reconnected after ${attemptNumber} attempts`);
    });

    this.socket.on("reconnect_error", (error: Error) => {
      console.error("Reconnection error:", error);
    });

    this.socket.on("reconnect_failed", () => {
      console.error(
        "Failed to reconnect to chat server after maximum attempts"
      );
      // You could notify the user here that they need to refresh the page
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

  public isConnected(): boolean {
    return this.socket.connected;
  }

  public reconnect(): void {
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }
}

export const chatService = new ChatService();
