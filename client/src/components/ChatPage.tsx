import { useState, useEffect } from 'react';
import { auth, db } from '../services/auth';
import { chatService } from '../services/chat';
import { toast } from 'react-toastify';
import { doc, onSnapshot } from 'firebase/firestore';

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
}

interface ChatPageProps {
  setPage: (page: "auth" | "verify" | "profile" | "main") => void;
}

const ChatPage = ({ setPage }: ChatPageProps) => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        toast.error('Please log in to chat');
        setPage("auth");
        return;
      }

      // Check if user document exists before connecting to WebSocket
      const userDocRef = doc(db, 'users', user.uid);
      const unsubscribeDoc = onSnapshot(userDocRef, (doc) => {
        if (!doc.exists()) {
          toast.error('Please complete your profile setup');
          setPage("profile");
          return;
        }

        // Connect to chat service only if user document exists
        chatService.connect();

        // Fetch conversations
        chatService.getConversations()
          .then((convos) => {
            setConversations(convos);
          })
          .catch(() => {
            toast.error('Failed to load conversations');
          });

        // Listen for new messages
        const unsubscribeMessages = chatService.onNewMessage((message) => {
          setMessages((prev) => [...prev, message]);
        });

        return () => {
          unsubscribeMessages();
          chatService.disconnect();
        };
      });

      return () => {
        unsubscribeDoc();
        unsubscribeAuth();
      };
    });

    return () => unsubscribeAuth();
  }, [setPage]);

  const startConversation = async (participantId: string) => {
    try {
      const conversation = await chatService.startConversation(participantId);
      setConversations((prev) => [...prev, conversation]);
      setSelectedConversation(conversation.id);
      const conversationMessages = await chatService.getMessages(conversation.id);
      setMessages(conversationMessages);
    } catch (error) {
      toast.error('Failed to start conversation');
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedConversation) return;
    try {
      await chatService.sendMessage(selectedConversation, input);
      setInput('');
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  const selectConversation = async (conversationId: string) => {
    setSelectedConversation(conversationId);
    const conversationMessages = await chatService.getMessages(conversationId);
    setMessages(conversationMessages);
  };

  return (
    <div className="flex h-screen">
      <div className="w-1/4 bg-gray-100 p-4">
        <h2 className="text-lg font-bold mb-4">Conversations</h2>
        <input
          type="text"
          placeholder="Enter user ID to start chat"
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              startConversation(e.currentTarget.value);
              e.currentTarget.value = '';
            }
          }}
          className="mb-4 p-2 border rounded w-full"
        />
        {conversations.map((convo) => (
          <div
            key={convo.id}
            onClick={() => selectConversation(convo.id)}
            className={`p-2 cursor-pointer ${selectedConversation === convo.id ? 'bg-blue-200' : 'hover:bg-gray-200'}`}
          >
            <p>{convo.participants.find((id: string) => id !== auth.currentUser?.uid)}</p>
            <small>{convo.lastMessage?.text || 'No messages yet'}</small>
          </div>
        ))}
      </div>
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`mb-2 flex ${
                    msg.senderId === auth.currentUser?.uid ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-xs p-3 rounded-lg ${
                      msg.senderId === auth.currentUser?.uid
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-black'
                    }`}
                  >
                    <p>{msg.text}</p>
                    <small>{new Date(msg.timestamp).toLocaleTimeString()}</small>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 flex">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                className="flex-1 p-2 border rounded-l"
              />
              <button
                onClick={sendMessage}
                className="bg-blue-500 text-white p-2 rounded-r"
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p>Select a conversation or start a new one</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;