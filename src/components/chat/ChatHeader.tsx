"use client";

import React from "react";
import { User } from "@/types/chat";
import { ArrowLeft, MoreVertical, Shield } from "lucide-react";

interface ChatHeaderProps {
  contactUser: User;
  isPeerTyping: boolean;
  onBackMobile: () => void;
  onOpenSecurityCenter: () => void;
  showMoreMenu: boolean;
  setShowMoreMenu: (show: boolean | ((prev: boolean) => boolean)) => void;
  moreMenuRef: React.RefObject<HTMLDivElement | null>;
}

export function ChatHeader({
  contactUser,
  isPeerTyping,
  onBackMobile,
  onOpenSecurityCenter,
  showMoreMenu,
  setShowMoreMenu,
  moreMenuRef,
}: ChatHeaderProps) {
  return (
    <header className="sticky top-0 h-16 px-4 md:px-6 bg-white flex items-center justify-between border-b border-[#f0f2f5] z-30 shrink-0 text-[#050505] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile Back Button */}
        <button
          onClick={onBackMobile}
          className="md:hidden p-2 -ml-2 text-[#0084ff] hover:bg-[#f0f2f5] rounded-full transition-colors cursor-pointer"
          title="Back to chats"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* Contact Avatar */}
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-[#e4e6eb]">
            <img
              src={contactUser.avatar}
              alt={contactUser.name}
              className="w-full h-full object-cover"
            />
          </div>
          {contactUser.isOnline && (
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#31a24c] ring-2 ring-white" />
          )}
        </div>

        {/* Contact Details & Status */}
        <div className="flex flex-col min-w-0 justify-center">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-[15px] text-[#050505] tracking-tight truncate leading-tight">
              {contactUser.name}
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#f0f2f5] text-[#65676b] font-medium truncate max-w-[120px]">
              @{contactUser.id.replace(/@.*$/, "")}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 leading-tight">
            {isPeerTyping ? (
              <span className="text-[#0084ff] font-medium text-xs animate-pulse">
                typing...
              </span>
            ) : (
              <span className="text-[#65676b] text-xs">
                {contactUser.isOnline ? "Active now" : "Offline"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex items-center gap-1 sm:gap-2">
        <div className="relative" ref={moreMenuRef}>
          <button
            onClick={() => setShowMoreMenu((prev) => !prev)}
            className="w-9 h-9 flex items-center justify-center text-[#0084ff] hover:bg-[#f0f2f5] rounded-full transition-colors cursor-pointer"
          >
            <MoreVertical className="h-5 w-5" />
          </button>

          {showMoreMenu && (
            <div
              className="absolute right-0 top-11 w-52 bg-white border border-[#e4e6eb] rounded-2xl p-1.5 z-50 text-xs text-[#050505] shadow-xl animate-in fade-in zoom-in-95 duration-100 divide-y divide-[#f0f2f5]"
              onClick={() => setShowMoreMenu(false)}
            >
              <div className="p-1 space-y-0.5">
                <button
                  onClick={onOpenSecurityCenter}
                  className="w-full text-left px-3 py-2 hover:bg-[#f0f2f5] rounded-xl flex items-center gap-2.5 cursor-pointer text-[#050505] font-medium transition-colors"
                >
                  <Shield className="h-4 w-4 text-[#65676b]" />
                  Security Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
