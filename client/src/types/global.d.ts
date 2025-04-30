import { ChatService } from '../services/chat';

declare global {
  interface Window {
    chatService?: ChatService;
  }
}