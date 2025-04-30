import io, { Socket } from "socket.io-client";
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
  private socket: typeof Socket;
  private messageQueue: { conversationId: string; text: string }[] = [];
  private messageHandlers: ((message: Message) => void)[] = [];
  private isInitialized = false;

  constructor() {
    this.socket = io(import.meta.env.VITE_API_URL || "http://localhost:3000", {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: {
        token: localStorage.getItem("token") || "",
      },
      // Removed the incorrect extraHeaders property
      transportOptions: {
        polling: {
          extraHeaders: {
            "Access-Control-Allow-Credentials": "true"
          }
        }
      },
      transports: ["websocket", "polling"]
    });

    // Setup event listeners
    this.socket.on("connect", this.handleConnect.bind(this));
    this.socket.on("disconnect", this.handleDisconnect.bind(this));
    this.socket.on("connect_error", this.handleError.bind(this));
    this.socket.on("new_message", this.handleNewMessage.bind(this));

    // Auto-connect when service is instantiated
    this.connect();
  }

  private handleConnect() {
    console.log("Connected to chat server");
    // Process any queued messages when connection is established
    this.processMessageQueue();
  }

  private handleDisconnect(reason: string) {
    console.log(`Disconnected: ${reason}`);
    // If the server disconnected us, try to reconnect
    if (reason === "io server disconnect") {
      this.socket.connect();
    }
  }

  private handleError(error: Error) {
    console.error("Connection error:", error);
    // If the error is about authentication, try to refresh the token
    if (error.message.includes("Authentication")) {
      this.refreshToken();
    }
  }

  private handleNewMessage(message: Message) {
    // Notify all registered handlers
    this.messageHandlers.forEach((handler) => handler(message));
  }

  // Add method to refresh token
  private refreshToken() {
    const auth = getAuth();
    if (auth.currentUser) {
      auth.currentUser
        .getIdToken(true)
        .then((token) => {
          this.updateToken(token);
        })
        .catch((error) => {
          console.error("Failed to refresh token:", error);
        });
    }
  }

  // Add a method to update the token and reconnect
  updateToken(token: string) {
    localStorage.setItem("token", token);
    // Fix the auth property access
    (this.socket as any).auth = { token };

    if (this.socket.disconnected) {
      this.socket.connect();
    }
  }

  // Update your connect method
  connect() {
    if (this.isInitialized) {
      // If already initialized, just reconnect if needed
      if (!this.socket.connected) {
        this.socket.connect();
      }
      return;
    }

    this.isInitialized = true;

    // Get a fresh token before connecting
    const auth = getAuth();
    if (auth.currentUser) {
      auth.currentUser
        .getIdToken(true)
        .then((token) => {
          localStorage.setItem("token", token);
          // Fix the auth property access
          (this.socket as any).auth = { token };
          this.socket.connect();
        })
        .catch((error) => {
          console.error("Failed to get token:", error);
          // Try to connect anyway
          this.socket.connect();
        });
    } else {
      console.log("No authenticated user, connecting without token");
      this.socket.connect();
    }
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

  public startConversation(participantId: string): Promise<Conversation> {
    return new Promise((resolve, reject) => {
      if (!this.socket.connected) {
        this.connect(); // Try to connect first
        reject(new Error("Not connected to chat server. Please try again."));
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
    this.messageHandlers.push(callback);
    return () => {
      // Return a function to remove the handler
      this.messageHandlers = this.messageHandlers.filter(
        (handler) => handler !== callback
      );
    };
  }

  public getConversations(): Promise<Conversation[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket.connected) {
        this.connect(); // Try to connect first
        reject(new Error("Not connected to chat server. Please try again."));
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
        this.connect(); // Try to connect first
        reject(new Error("Not connected to chat server. Please try again."));
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

// Export as singleton
const chatService = new ChatService();
export default chatService;
export { chatService };