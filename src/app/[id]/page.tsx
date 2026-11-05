"use client";

import React from "react";
import { useChat } from "@/components/chat/ChatContext";
import { ChatArea } from "@/components/chat/ChatArea";

export default function ChatPage() {
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
    togglePinMessage,
    addReaction,
    clearChat,
    sendTyping,
    openSafetyNumbers,
    openSecurityCenter,
    backToHome,
  } = useChat();

  if (!contactUser || contactUser.id === "none") {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-white text-center p-8 select-none">
        <div className="w-6 h-6 border-2 border-[#cbd5e1] border-t-[#0084ff] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ChatArea
      currentUser={currentUser}
      contactUser={contactUser}
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
      onTogglePinMessage={togglePinMessage}
    />
  );
}
