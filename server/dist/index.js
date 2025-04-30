import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Initialize Firebase Admin
initializeApp({
  credential: applicationDefault(),
  projectId: "chatme-webapp",
});

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const db = getFirestore();
app.use(cors());
app.use(express.json());

// Middleware to authenticate Socket.IO connections
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("No token provided"));
    }
    const decodedToken = await getAuth().verifyIdToken(token);
    socket.data.userId = decodedToken.uid;

    // Check if user document exists in Firestore
    const userDoc = await db.collection("users").doc(decodedToken.uid).get();
    if (!userDoc.exists()) {
      return next(new Error("User profile not found. Please complete your profile setup."));
    }

    next();
  } catch (error) {
    console.error("Socket authentication error:", error);
    next(new Error("Authentication failed"));
  }
});

// Socket.IO event handlers
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.data.userId}`);

  // Join user's conversations
  db.collection("conversations")
    .where("participants", "array-contains", socket.data.userId)
    .get()
    .then((snapshot) => {
      snapshot.forEach((doc) => {
        socket.join(doc.id);
      });
    })
    .catch((error) => {
      console.error("Error joining conversations:", error);
    });

  // Handle get conversations
  socket.on("get_conversations", async (callback) => {
    try {
      const snapshot = await db
        .collection("conversations")
        .where("participants", "array-contains", socket.data.userId)
        .orderBy("updatedAt", "desc")
        .get();
      const conversations = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback({ success: true, data: conversations });
    } catch (error) {
      console.error("Error getting conversations:", error);
      callback({ success: false, error: "Failed to get conversations" });
    }
  });

  // Handle get messages
  socket.on("get_messages", async ({ conversationId }, callback) => {
    try {
      const conversationDoc = await db.collection("conversations").doc(conversationId).get();
      if (!conversationDoc.exists()) {
        return callback({ success: false, error: "Conversation not found" });
      }
      const snapshot = await db
        .collection("conversations")
        .doc(conversationId)
        .collection("messages")
        .orderBy("timestamp", "asc")
        .get();
      const messages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback({ success: true, data: messages });
    } catch (error) {
      console.error("Error getting messages:", error);
      callback({ success: false, error: "Failed to get messages" });
    }
  });

  // Handle send message
  socket.on("send_message", async ({ conversationId, text }, callback) => {
    try {
      const conversationDoc = await db.collection("conversations").doc(conversationId).get();
      if (!conversationDoc.exists()) {
        return callback({ success: false, error: "Conversation not found" });
      }
      const messageRef = db
        .collection("conversations")
        .doc(conversationId)
        .collection("messages")
        .doc();
      const message = {
        id: messageRef.id,
        senderId: socket.data.userId,
        text,
        timestamp: Date.now(),
      };
      await messageRef.set(message);
      await db.collection("conversations").doc(conversationId).update({
        lastMessage: message,
        updatedAt: Date.now(),
      });
      io.to(conversationId).emit("new_message", message);
      callback({ success: true });
    } catch (error) {
      console.error("Error sending message:", error);
      callback({ success: false, error: "Failed to send message" });
    }
  });

  // Handle start conversation
  socket.on("start_conversation", async ({ participantId }, callback) => {
    try {
      // Verify participant exists
      const participantDoc = await db.collection("users").doc(participantId).get();
      if (!participantDoc.exists()) {
        return callback({ success: false, error: "Participant not found" });
      }

      const conversationId = [socket.data.userId, participantId].sort().join('-');
      const conversationRef = db.collection("conversations").doc(conversationId);
      const conversationDoc = await conversationRef.get();

      if (!conversationDoc.exists()) {
        const conversation = {
          id: conversationId,
          participants: [socket.data.userId, participantId],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await conversationRef.set(conversation);
      }

      socket.join(conversationId);
      callback({ 
        success: true, 
        data: conversationDoc.exists() 
          ? conversationDoc.data() 
          : { id: conversationId, participants: [socket.data.userId, participantId] }
      });
    } catch (error) {
      console.error("Error starting conversation:", error);
      callback({ success: false, error: "Failed to start conversation" });
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.data.userId}`);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});