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
} from "lucide-react";

interface ChatSidebarProps {
  currentUser: User;
  contactUser: User;
  contacts?: User[];
  messages: Message[];
  settings: SecuritySettings;
  selectedChatId: string;
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
  onSelectChat,
  onOpenSecurityCenter,
  onLockApp,
  onLogout,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "unread" | "expiring">("all");

  const effectiveContacts = contacts.length > 0 ? contacts : [contactUser];

  // Helper to get messages for a real user contact
  const getContactMessages = (contact: User) => {
    return messages.filter(
      (m) =>
        (m.senderId === contact.id && m.recipientId === currentUser.id) ||
        (m.senderId === currentUser.id && m.recipientId === contact.id)
    );
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
    <aside className="w-full md:w-[350px] lg:w-[380px] h-full flex flex-col bg-white border-r border-slate-200 select-none shrink-0 relative z-20">
      {/* Top Header */}
      <div className="h-16 px-4 bg-white flex items-center justify-between border-b border-slate-100">
        {/* User Identity Profile */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 border border-slate-200">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>

          <div className="flex flex-col min-w-0 justify-center">
            <span className="font-semibold text-sm text-slate-900 tracking-tight truncate leading-tight">
              {currentUser.name}
            </span>
            <span className="text-xs font-mono text-emerald-600 truncate leading-tight mt-0.5">
              @{currentUser.id}
            </span>
          </div>
        </div>

        {/* Header Action Tools */}
        <div className="flex items-center gap-1">
          {/* Security Command Center Button */}
          <button
            onClick={onOpenSecurityCenter}
            title="Privacy & Security"
            className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <Shield className="h-4 w-4" />
          </button>

          {/* App Lock Button */}
          <button
            onClick={onLockApp}
            title="Lock Chat"
            className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <Lock className="h-4 w-4" />
          </button>

          {/* Log Out Button */}
          {onLogout && (
            <button
              onClick={onLogout}
              title="Log Out"
              className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Modern Search Bar */}
      <div className="px-4 py-2.5">
        <div className="relative flex items-center bg-slate-100 rounded-full px-3.5 py-2 text-slate-900 focus-within:bg-white focus-within:ring-1 focus-within:ring-slate-300 transition-all">
          <Search className="h-4 w-4 text-slate-400 shrink-0 mr-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search @username or name..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 px-4 pb-2 border-b border-slate-100 overflow-x-auto text-xs scrollbar-none">
        {(
          [
            { id: "all", label: "All Users" },
            { id: "unread", label: "Unread" },
            { id: "expiring", label: "Expiring" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterTab(tab.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              filterTab === tab.id
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Directory Count Header */}
      <div className="px-4 pt-2.5 pb-1 flex items-center justify-between">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
          <Users className="h-3 w-3" />
          Registered Users
        </span>
        <span className="text-[10px] text-emerald-600 font-mono font-medium">
          {filteredContacts.length} online
        </span>
      </div>

      {/* Real Users Conversation Cards List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {filteredContacts.map((contact) => {
          const contactMessages = getContactMessages(contact);
          const lastMessage = contactMessages.length > 0 ? contactMessages[contactMessages.length - 1] : null;
          const hasPinned = contactMessages.some((m) => m.isPinned);

          return (
            <div
              key={contact.id}
              onClick={() => onSelectChat(contact.id)}
              className={`group flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                selectedChatId === contact.id ? "bg-slate-100" : "hover:bg-slate-50"
              }`}
            >
              {/* Contact Avatar */}
              <div className="relative shrink-0">
                <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-100 border border-slate-200/80 flex items-center justify-center">
                  <img
                    src={contact.avatar}
                    alt={contact.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                {contact.isOnline && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                )}
              </div>

              {/* Conversation Details */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-xs sm:text-sm text-slate-900 truncate leading-tight">
                      {contact.name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200/60 font-medium truncate max-w-[120px]">
                      @{contact.id}
                    </span>
                    {hasPinned && (
                      <span className="text-[9.5px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                        Pinned
                      </span>
                    )}
                  </div>

                  {lastMessage && (
                    <span className="text-[11px] text-slate-400 shrink-0 ml-1">
                      {new Date(lastMessage.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-slate-500 truncate pr-2">
                    {lastMessage ? (
                      <>
                        {lastMessage.senderId === currentUser.id && (
                          <CheckCheck
                            className={`h-3 w-3 shrink-0 ${
                              lastMessage.status === "read"
                                ? "text-blue-500"
                                : "text-slate-400"
                            }`}
                          />
                        )}
                        <span className="truncate group-hover:text-slate-700 transition-colors text-slate-500 text-[12px]">
                          {lastMessage.text}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-400 text-[11.5px] truncate">
                        Zero-Knowledge encrypted · Click to chat
                      </span>
                    )}
                  </div>

                  {settings.disappearingTimer > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-amber-600 font-medium shrink-0">
                      <Timer className="h-3 w-3" />
                      {settings.disappearingTimer}s
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredContacts.length === 0 && (
          <div className="py-12 text-center text-xs text-slate-400 px-4">
            {searchQuery
              ? `No users matching "${searchQuery}"`
              : "No other registered users online yet."}
          </div>
        )}
      </div>

      {/* Subtle Footer */}
      <div className="px-4 py-3 bg-white border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Real Users Directory</span>
        </div>
        <button
          onClick={onOpenSecurityCenter}
          className="text-slate-500 hover:text-slate-800 transition-colors font-medium cursor-pointer"
        >
          Security
        </button>
      </div>
    </aside>
  );
}
