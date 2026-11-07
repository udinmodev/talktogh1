"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useChat } from "@/components/chat/ChatContext";
import { ChatArea } from "@/components/chat/ChatArea";
import { User } from "@/types/chat";
import { UserX } from "lucide-react";

export default function ChatPage() {
  const router = useRouter();
  const params = useParams();
  const rawParam = typeof params?.id === "string" ? params.id : "";
  const routeContactId = rawParam ? decodeURIComponent(rawParam).split("@")[0].toLowerCase() : "";

  const {
    currentUser,
    contactUser,
    contacts,
    isLoadingContacts,
    activeMessages,
    settings,
    sessionKey,
    isLoadingMessages,
    hasMoreMessages,
    isLoadingMoreMessages,
    loadMoreMessages,
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

  // If route is explicitly /none or the user's own identity, redirect home immediately
  useEffect(() => {
    if (routeContactId === "none" || (currentUser?.id && routeContactId === currentUser.id)) {
      router.replace("/");
    }
  }, [routeContactId, currentUser?.id, router]);

  // While contacts directory is loading, show spinner
  if (isLoadingContacts) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-white text-center p-8 select-none">
        <div className="w-6 h-6 border-2 border-[#cbd5e1] border-t-[#0084ff] rounded-full animate-spin" />
      </div>
    );
  }

  // Only resolve to an actual registered contact - NEVER fabricate a fake identity
  const matchedContact = contacts.find((c) => c.id === routeContactId);
  const effectiveContact: User | null =
    (contactUser && contactUser.id !== "none" && contactUser.id === routeContactId)
      ? contactUser
      : matchedContact || null;

  // If the user does not exist on the network, reject and display User Not Found screen
  if (!effectiveContact || routeContactId === "none") {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-white text-center p-8 select-none">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4 shadow-xs">
          <UserX className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-[#050505] mb-1">User Not Found</h3>
        <p className="text-xs text-[#65676b] max-w-xs leading-relaxed mb-5">
          {routeContactId && routeContactId !== "none"
            ? `@${routeContactId} does not exist on this private network.`
            : "No user selected."}
        </p>
        <button
          onClick={backToHome}
          className="px-5 py-2 bg-[#0084ff] hover:bg-[#0073e6] text-white text-xs font-semibold rounded-full transition-colors cursor-pointer shadow-xs active:scale-95"
        >
          Back to chats
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden">
      <ChatArea
        currentUser={currentUser}
        contactUser={effectiveContact}
        messages={activeMessages}
        settings={settings}
        sessionKey={sessionKey}
        isLoading={isLoadingMessages}
        hasMoreMessages={hasMoreMessages}
        isLoadingMoreMessages={isLoadingMoreMessages}
        onLoadMoreMessages={loadMoreMessages}
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
    </div>
  );
}
