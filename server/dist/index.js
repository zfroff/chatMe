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
// Initialize Firebase Admin with explicit path to credentials
initializeApp({
    credential: applicationDefault(),
    projectId: "message-me-265b0",
});
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173", // Vite's default port
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
            throw new Error("No token provided");
        }
        const decodedToken = await getAuth().verifyIdToken(token);
        socket.data.userId = decodedToken.uid;
        next();
    }
    catch (error) {
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
        }
        catch (error) {
            console.error("Error getting conversations:", error);
            callback({ success: false, error: "Failed to get conversations" });
        }
    });
    // Handle get messages
    socket.on("get_messages", async ({ conversationId }, callback) => {
        try {
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
        }
        catch (error) {
            console.error("Error getting messages:", error);
            callback({ success: false, error: "Failed to get messages" });
        }
    });
    // Handle send message
    socket.on("send_message", async ({ conversationId, text }, callback) => {
        try {
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
            // Update conversation's last message and timestamp
            await db.collection("conversations").doc(conversationId).update({
                lastMessage: message,
                updatedAt: Date.now(),
            });
            // Broadcast to all users in the conversation
            io.to(conversationId).emit("new_message", message);
            callback({ success: true });
        }
        catch (error) {
            console.error("Error sending message:", error);
            callback({ success: false, error: "Failed to send message" });
        }
    });
    // Handle start conversation
    socket.on("start_conversation", async ({ participantId }, callback) => {
        try {
            const conversationRef = db.collection("conversations").doc();
            const conversation = {
                id: conversationRef.id,
                participants: [socket.data.userId, participantId],
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            await conversationRef.set(conversation);
            // Join the room
            socket.join(conversation.id);
            callback({ success: true, data: conversation });
        }
        catch (error) {
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
