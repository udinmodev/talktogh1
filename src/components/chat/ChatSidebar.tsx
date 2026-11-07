"use client";

import React, { useState } from "react";
import { User, Message, SecuritySettings } from "@/types/chat";
import {
  Shield,
  Search,
  Lock,
  Timer,
  CheckCheck,
  LogOut,
  Users,
  ShieldCheck,
} from "lucide-react";

interface ChatSidebarProps {
  currentUser: User;
  contactUser: User;
  contacts?: User[];
  messages: Message[];
  settings: SecuritySettings;
  selectedChatId: string;
  isLoading?: boolean;
  isOnline?: boolean;
  onSelectChat: (id: string) => void;
  onOpenSecurityCenter: () => void;
  onSwitchUser: () => void;
  onLockApp: () => void;
  onLogout?: () => void;
}

export function ChatSidebar({
  currentUser,
  contactUser,
  contacts = [],
  messages,
  settings,
  selectedChatId,
  isLoading = false,
  isOnline = true,
  onSelectChat,
  onOpenSecurityCenter,
  onLockApp,
  onLogout,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "unread" | "expiring">("all");

  const effectiveContacts = contacts.length > 0 ? contacts.filter((c) => c && c.id && c.id !== "none") : [];

  // Helper to get messages for a real user contact
  const getContactMessages = (contact: User) => {
    const cId = String(contact.id || "").split("@")[0].toLowerCase();
    const myId = String(currentUser.id || "").split("@")[0].toLowerCase();
    return messages.filter((m) => {
      const s = String(m.senderId || "").split("@")[0].toLowerCase();
      const r = String(m.recipientId || "").split("@")[0].toLowerCase();
      return (s === cId && r === myId) || (s === myId && r === cId);
    });
  };

  const filteredContacts = effectiveContacts.filter((contact) => {
    const contactMessages = getContactMessages(contact);
    const lastMsg = contactMessages.length > 0 ? contactMessages[contactMessages.length - 1] : null;

    const matchesSearch =
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contact.phone && contact.phone.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (lastMsg && lastMsg.text.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterTab === "expiring") return settings.disappearingTimer > 0;
    if (filterTab === "unread") return contactMessages.some((m) => m.senderId === contact.id && m.status !== "read");
    return true;
  });

  return (
    <aside className="w-full md:w-[350px] lg:w-[380px] h-full flex flex-col bg-white border-r border-[#f0f2f5] text-[#050505] select-none shrink-0 relative z-20">
      {/* Messenger Top Header: "Chats" with circular action buttons */}
      <div className="pt-4 px-4 pb-2 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* User Profile */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-[#e4e6eb] ring-1 ring-[#ced0d4]">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-full h-full object-cover"
              />
            </div>
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white ${
                isOnline ? "bg-[#31a24c]" : "bg-[#fa383e]"
              }`}
              title={isOnline ? "Online" : "Offline (No Internet)"}
            />
          </div>
          <h1
            onClick={() => onSelectChat("")}
            className="text-2xl font-bold tracking-tight text-[#050505] cursor-pointer hover:opacity-80 transition-opacity"
            title="Go to Home"
          >
            Chats
          </h1>
        </div>

        {/* Messenger Circular Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Security Command Center Button */}
          <button
            onClick={onOpenSecurityCenter}
            title="Privacy & Security"
            className="w-9 h-9 rounded-full bg-[#f0f2f5] hover:bg-[#e4e6eb] text-[#050505] flex items-center justify-center transition-colors cursor-pointer"
          >
            <Shield className="h-4 w-4" />
          </button>

          {/* App Lock Button */}
          <button
            onClick={onLockApp}
            title="Lock Chat"
            className="w-9 h-9 rounded-full bg-[#f0f2f5] hover:bg-[#e4e6eb] text-[#050505] flex items-center justify-center transition-colors cursor-pointer"
          >
            <Lock className="h-4 w-4" />
          </button>

          {/* Log Out Button */}
          {onLogout && (
            <button
              onClick={onLogout}
              title="Log Out"
              className="w-9 h-9 rounded-full bg-[#f0f2f5] hover:bg-rose-50 text-[#050505] hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messenger Pill Search Bar */}
      <div className="px-4 py-2 bg-white">
        <div className="relative flex items-center bg-[#f0f2f5] rounded-full px-4 py-2 text-[#050505] focus-within:ring-2 focus-within:ring-[#0084ff]/20 transition-all">
          <Search className="h-4 w-4 text-[#65676b] shrink-0 mr-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search TalkTogether"
            className="w-full bg-transparent text-sm text-[#050505] placeholder:text-[#65676b] focus:outline-none"
          />
        </div>
      </div>

      {/* Messenger Filter Chips */}
      <div className="flex items-center gap-2 px-4 pb-2.5 overflow-x-auto text-xs scrollbar-none">
        {(
          [
            { id: "all", label: "Inbox" },
            { id: "unread", label: "Unread" },
            { id: "expiring", label: "Disappearing" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterTab(tab.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              filterTab === tab.id
                ? "bg-[#e7f3ff] text-[#0084ff]"
                : "bg-[#f0f2f5] text-[#050505] hover:bg-[#e4e6eb]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Real Users Conversation Cards List - Messenger Item Row Pattern */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {isLoading ? (
          <div className="space-y-1 py-1">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-2.5 rounded-2xl animate-pulse"
              >
                {/* Shimmer Avatar */}
                <div className="w-14 h-14 rounded-full bg-[#e4e6eb] shrink-0" />
                {/* Shimmer Information Lines */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-4 bg-[#e4e6eb] rounded-full w-28" />
                    <div className="h-3 bg-[#f0f2f5] rounded-full w-10" />
                  </div>
                  <div className="h-3.5 bg-[#f0f2f5] rounded-full w-44" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          filteredContacts.map((contact) => {
            const contactMessages = getContactMessages(contact);
            const lastMessage = contactMessages.length > 0 ? contactMessages[contactMessages.length - 1] : null;
            const hasPinned = contactMessages.some((m) => m.isPinned);
            const isSelected = selectedChatId === contact.id;

            return (
              <div
                key={contact.id}
                onClick={() => onSelectChat(contact.id)}
                className={`group flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-all ${
                  isSelected
                    ? "bg-[#eaf3ff] text-[#050505]"
                    : "hover:bg-[#f2f2f2] text-[#050505]"
                }`}
              >
              {/* Contact Avatar with Messenger Green Active Dot */}
              <div className="relative shrink-0">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-[#e4e6eb] flex items-center justify-center">
                  <img
                    src={contact.avatar}
                    alt={contact.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                {contact.isOnline && (
                  <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[#31a24c] ring-2 ring-white" />
                )}
              </div>

              {/* Conversation Details */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-[15px] text-[#050505] truncate leading-tight">
                      {contact.name}
                    </span>
                    {hasPinned && (
                      <span className="text-[10px] bg-[#f0f2f5] text-[#0084ff] px-2 py-0.5 rounded-full font-semibold">
                        Pinned
                      </span>
                    )}
                  </div>

                  {lastMessage && (
                    <span className="text-[12px] text-[#65676b] shrink-0 ml-1">
                      {new Date(lastMessage.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-1 text-[#65676b] truncate pr-2">
                    {lastMessage ? (
                      <>
                        {lastMessage.senderId === currentUser.id && (
                          <span className="text-[#65676b] text-xs">You:</span>
                        )}
                        <span className="truncate group-hover:text-[#050505] transition-colors text-[#65676b]">
                          {lastMessage.text}
                        </span>
                      </>
                    ) : isLoading ? (
                      <div className="h-3.5 bg-[#f0f2f5] rounded-full w-24 animate-pulse mt-0.5" />
                    ) : (
                      <span className="text-[#0084ff] font-medium text-xs truncate">
                        Say hi to @{contact.id.replace(/@.*$/, "")} 👋
                      </span>
                    )}
                  </div>

                  {settings.disappearingTimer > 0 && (
                    <span className="flex items-center gap-0.5 text-[11px] text-amber-600 font-medium shrink-0">
                      <Timer className="h-3 w-3" />
                      {settings.disappearingTimer}s
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      {!isLoading && filteredContacts.length === 0 && (
        <div className="py-12 text-center text-xs text-[#65676b] px-4">
          {searchQuery
            ? `No contacts matching "${searchQuery}"`
            : "No contacts online."}
        </div>
      )}
    </div>

      {/* Messenger Footer Identity Bar */}
      <div className="px-4 py-3 bg-white border-t border-[#f0f2f5] text-xs text-[#65676b] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#31a24c]" />
          <span className="font-medium text-[#050505]">@{currentUser.id.replace(/@.*$/, "")}</span>
        </div>
        <button
          onClick={onOpenSecurityCenter}
          className="text-[#0084ff] hover:underline font-semibold cursor-pointer"
        >
          Security
        </button>
      </div>
    </aside>
  );
}
