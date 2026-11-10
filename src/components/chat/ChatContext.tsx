"use client";

import React, { createContext, useContext } from "react";
import { User, Message, SecuritySettings } from "@/types/chat";

export interface ChatContextType {
  currentUser: User;
  contactUser: User;
  contacts: User[];
  selectedContactId: string;
  activeMessages: Message[];
  allMessages: Message[];
  settings: SecuritySettings;
  sessionKey: CryptoKey | null;
  isLoadingContacts: boolean;
  isLoadingMessages: boolean;
  hasMoreMessages?: boolean;
  isLoadingMoreMessages?: boolean;
  loadMoreMessages?: () => Promise<void>;
  isPeerTyping: boolean;
  isOnline: boolean;
  networkError: string | null;
  sendMessage: (
    text: string,
    mediaType?: "image" | "voice" | "doc",
    mediaUrl?: string,
    viewOnce?: boolean,
    customDuration?: number | null
  ) => void;
  editMessage: (messageId: string, newText: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => void;
  burnMessage: (messageId: string) => void;
  togglePinMessage: (messageId: string) => void;
  addReaction: (messageId: string, emoji: string) => void;
  sendTyping: (isTyping: boolean) => void;
  openSafetyNumbers: () => void;
  openSecurityCenter: () => void;
  backToHome: () => void;
  selectChat: (id: string) => void;
  updateSettings: (opts: Partial<SecuritySettings>) => void;
  lockApp: () => void;
  logout: () => void;
}

export const ChatContext = createContext<ChatContextType | null>(null);

export function useChat(): ChatContextType {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a RootChatShell provider");
  }
  return context;
}
