import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Initialize Firebase Admin with service account
initializeApp({
  credential: cert(
    process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account.json"
  ),
  projectId: "chatme-webapp",
});

const app = express();
const httpServer = createServer(app);

// Define interfaces
interface User {
  uid: string;
  nickname: string;
  displayName: string;
  photoURL?: string;
  createdAt: number;
  updatedAt: number;
}

// Configure CORS
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"],
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  cookie: {
    name: "io",
    path: "/",
    httpOnly: true,
    sameSite: "lax"
  }
});

const db = getFirestore();

// API Endpoints
app.post("/api/check-nickname", async (req, res) => {
  try {
    const { nickname } = req.body;
    if (!nickname) {
      return res.status(400).json({ success: false, error: "Nickname is required" });
    }
    const nicknameRegex = /^[a-z0-9._]+$/;
    if (!nicknameRegex.test(nickname)) {
      return res.json({ success: false, error: "Invalid nickname format" });
    }
    const usersRef = db.collection("users");
    try {
      const snapshot = await usersRef.where("nickname", "==", nickname).get();
      return res.json({ success: snapshot.empty });
    } catch (error) {
      if ((error as { code: number }).code === 5) {
        return res.json({ success: true });
      }
      throw error;
    }
  } catch (error) {
    console.error("Error checking nickname:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

app.post("/api/update-profile", async (req, res) => {
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];
    if (!token) {
      return res.status(401).json({ success: false, error: "No token provided" });
    }
    const decodedToken = await getAuth().verifyIdToken(token);
    const { nickname, displayName, photoURL } = req.body;
    if (!nickname || !displayName) {
      return res.status(400).json({ success: false, error: "Nickname and display name are required" });
    }
    const nicknameRegex = /^[a-z0-9._]+$/;
    if (!nicknameRegex.test(nickname)) {
      return res.status(400).json({ success: false, error: "Invalid nickname format" });
    }
    const usersRef = db.collection("users");
    const nicknameSnapshot = await usersRef
      .where("nickname", "==", nickname)
      .where("uid", "!=", decodedToken.uid)
      .get();
    if (!nicknameSnapshot.empty) {
      return res.json({ success: false, error: "Nickname already taken" });
    }
    await usersRef.doc(decodedToken.uid).set(
      {
        uid: decodedToken.uid,
        nickname,
        displayName,
        photoURL,
        updatedAt: Date.now(),
        createdAt: Date.now(),
      },
      { merge: true }
    );
    return res.json({ success: true });
  } catch (error) {
    console.error("Error updating profile:", error);
    if ((error as {code: string}).code === 'auth/invalid-token') {
      return res.status(401).json({ success: false, error: "Invalid authentication token" });
    }
    return res.status(500).json({ success: false, error: "Server error", details: (error as Error).message });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];
    if (!token) {
      return res.status(401).json({ success: false, error: "No token provided" });
    }
    const decodedToken = await getAuth().verifyIdToken(token);
    const { nickname, displayName, photoURL } = req.body;
    const nicknameRegex = /^[a-z0-9._]+$/;
    if (!nicknameRegex.test(nickname)) {
      return res.status(400).json({ success: false, error: "Invalid nickname format" });
    }
    const existingUser = await db.collection("users").where("nickname", "==", nickname).get();
    if (!existingUser.empty) {
      return res.status(400).json({ success: false, error: "Nickname already taken" });
    }
    const user: User = {
      uid: decodedToken.uid,
      nickname,
      displayName,
      photoURL,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.collection("users").doc(decodedToken.uid).set(user);
    res.json({ success: true, data: user });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ success: false, error: "Failed to create user profile" });
  }
});

app.get("/api/users/search", async (req, res) => {
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];
    if (!token) {
      return res.status(401).json({ success: false, error: "No token provided" });
    }
    await getAuth().verifyIdToken(token);
    const { query } = req.query;
    if (typeof query !== "string" || query.length < 1) {
      return res.status(400).json({ success: false, error: "Invalid search query" });
    }
    const usersSnapshot = await db
      .collection("users")
      .where("nickname", ">=", query)
      .where("nickname", "<=", query + "\uf8ff")
      .limit(10)
      .get();
    const users = usersSnapshot.docs.map((doc) => ({ ...doc.data(), uid: doc.id }));
    res.json({ success: true, data: users });
  } catch (error) {
    console.error("Error searching users:", error);
    res.status(500).json({ success: false, error: "Failed to search users" });
  }
});

// Middleware to authenticate Socket.IO connections
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication token is required"));
    }
    const decodedToken = await getAuth().verifyIdToken(token);
    socket.data.userId = decodedToken.uid;

    // Check if user document exists in Firestore
    const userDoc = await db.collection("users").doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return next(new Error("User profile not found. Please complete your profile setup."));
    }

    next();
  } catch (error) {
    console.error("Socket authentication error:", error);
    next(new Error("Invalid authentication token"));
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
      if (typeof callback === 'function') {
        callback({ success: true, data: conversations });
      }
    } catch (error) {
      console.error("Error getting conversations:", error);
      if (typeof callback === 'function') {
        callback({ success: false, error: "Failed to get conversations" });
      }
    }
  });

  // Handle get messages
  socket.on("get_messages", async ({ conversationId }, callback) => {
    try {
      const conversationDoc = await db.collection("conversations").doc(conversationId).get();
      if (!conversationDoc.exists) {
        if (typeof callback === 'function') {
          return callback({ success: false, error: "Conversation not found" });
        }
        return;
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
      if (typeof callback === 'function') {
        callback({ success: true, data: messages });
      }
    } catch (error) {
      console.error("Error getting messages:", error);
      if (typeof callback === 'function') {
        callback({ success: false, error: "Failed to get messages" });
      }
    }
  });

  // Handle send message
  socket.on("send_message", async ({ conversationId, text }, callback) => {
    try {
      const conversationDoc = await db.collection("conversations").doc(conversationId).get();
      if (!conversationDoc.exists) {
        if (typeof callback === 'function') {
          return callback({ success: false, error: "Conversation not found" });
        }
        return;
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
      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      if (typeof callback === 'function') {
        callback({ success: false, error: "Failed to send message" });
      }
    }
  });

  // Handle start conversation
  socket.on("start_conversation", async ({ participantId }, callback) => {
    try {
      const participantDoc = await db.collection("users").doc(participantId).get();
      if (!participantDoc.exists) {
        if (typeof callback === 'function') {
          return callback({ success: false, error: "Participant not found" });
        }
        return;
      }
      const conversationId = [socket.data.userId, participantId].sort().join('-');
      const conversationRef = db.collection("conversations").doc(conversationId);
      const conversationDoc = await conversationRef.get();
      if (!conversationDoc.exists) {
        const conversation = {
          id: conversationId,
          participants: [socket.data.userId, participantId],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await conversationRef.set(conversation);
      }
      socket.join(conversationId);
      if (typeof callback === 'function') {
        callback({ 
          success: true, 
          data: conversationDoc.exists
            ? conversationDoc.data() 
            : { id: conversationId, participants: [socket.data.userId, participantId] }
        });
      }
    } catch (error) {
      console.error("Error starting conversation:", error);
      if (typeof callback === 'function') {
        callback({ success: false, error: "Failed to start conversation" });
      }
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