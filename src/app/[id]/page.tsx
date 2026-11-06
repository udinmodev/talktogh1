"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useChat } from "@/components/chat/ChatContext";
import { ChatArea } from "@/components/chat/ChatArea";
import { User } from "@/types/chat";

export default function ChatPage() {
  const params = useParams();
  const routeContactId = typeof params?.id === "string" ? params.id : "";

  const {
    currentUser,
    contactUser,
    activeMessages,
    settings,
    sessionKey,
    isLoadingMessages,
    isPeerTyping,
    isOnline,
    sendMessage,
    burnMessage,
    deleteMessage,
    editMessage,
    togglePinMessage,
    addReaction,
    clearChat,
    sendTyping,
    openSafetyNumbers,
    openSecurityCenter,
    backToHome,
  } = useChat();

  const effectiveContact: User | null =
    contactUser && contactUser.id !== "none"
      ? contactUser
      : routeContactId
      ? {
          id: routeContactId,
          name: routeContactId,
          role: "contact" as const,
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(routeContactId)}`,
          phone: `@${routeContactId}`,
          about: "Registered confidential identity.",
          publicKeyFingerprint: "7EFE2C6DCC10DA73",
          isOnline: false,
        }
      : null;

  if (!effectiveContact) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-white text-center p-8 select-none">
        <div className="w-6 h-6 border-2 border-[#cbd5e1] border-t-[#0084ff] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ChatArea
      currentUser={currentUser}
      contactUser={effectiveContact}
      messages={activeMessages}
      settings={settings}
      sessionKey={sessionKey}
      isLoading={isLoadingMessages}
      isOnline={isOnline}
      onSendMessage={sendMessage}
      onOpenSafetyNumbers={openSafetyNumbers}
      onOpenSecurityCenter={openSecurityCenter}
      onBackMobile={backToHome}
      onAddReaction={addReaction}
      onClearChat={clearChat}
      onTyping={sendTyping}
      isPeerTyping={isPeerTyping}
      onBurnMessage={burnMessage}
      onDeleteMessage={deleteMessage}
      onEditMessage={editMessage}
      onTogglePinMessage={togglePinMessage}
    />
  );
}
