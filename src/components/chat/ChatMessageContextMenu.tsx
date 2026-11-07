"use client";

import React from "react";
import { Message, User, SecuritySettings } from "@/types/chat";
import { Pencil, Copy, Pin, Trash2 } from "lucide-react";

interface ChatMessageContextMenuProps {
  contextMenu: {
    x: number;
    y: number;
    message: Message;
  } | null;
  currentUser: User;
  settings: SecuritySettings;
  quickReactions: string[];
  onClose: () => void;
  onAddReaction: (messageId: string, emoji: string) => void;
  onStartEdit: (message: Message) => void;
  onTogglePinMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
}

export function ChatMessageContextMenu({
  contextMenu,
  currentUser,
  settings,
  quickReactions,
  onClose,
  onAddReaction,
  onStartEdit,
  onTogglePinMessage,
  onDeleteMessage,
}: ChatMessageContextMenuProps) {
  if (!contextMenu) return null;

  const msg = contextMenu.message;
  const isMe = msg.senderId === currentUser.id;

  return (
    <div
      style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
      className="fixed z-[90] bg-white border border-[#e4e6eb] rounded-2xl p-1.5 shadow-2xl text-[#050505] min-w-[210px] animate-in fade-in zoom-in-95 duration-100 select-none text-xs"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Reaction Bar in Dropdown */}
      <div className="flex items-center justify-around py-1 px-1 border-b border-neutral-100 mb-1">
        {quickReactions.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              onAddReaction(msg.id, emoji);
              onClose();
            }}
            className="hover:scale-125 transition-transform text-sm p-1 cursor-pointer"
            title={`React ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Action List */}
      <div className="space-y-0.5">
        {/* Edit (if sender's message and not viewOnce) */}
        {isMe && !msg.viewOnce && (
          <button
            type="button"
            onClick={() => {
              onStartEdit(msg);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#f0f2f5] text-neutral-800 font-medium cursor-pointer transition-colors text-left"
          >
            <Pencil className="h-4 w-4 text-[#0084ff]" />
            <span>Edit message</span>
          </button>
        )}

        {/* Copy Text */}
        {!settings.preventCopyForward && msg.text && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(msg.text);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#f0f2f5] text-neutral-800 font-medium cursor-pointer transition-colors text-left"
          >
            <Copy className="h-4 w-4 text-neutral-500" />
            <span>Copy text</span>
          </button>
        )}

        {/* Pin / Unpin */}
        {onTogglePinMessage && (
          <button
            type="button"
            onClick={() => {
              onTogglePinMessage(msg.id);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#f0f2f5] text-neutral-800 font-medium cursor-pointer transition-colors text-left"
          >
            <Pin
              className={`h-4 w-4 ${
                msg.isPinned ? "fill-current text-amber-500" : "text-neutral-500"
              }`}
            />
            <span>{msg.isPinned ? "Unpin message" : "Pin message"}</span>
          </button>
        )}

        {/* Delete (if sender's message) */}
        {isMe && (
          <>
            <div className="h-[1px] bg-neutral-100 my-1" />
            <button
              type="button"
              onClick={() => {
                const msgId = msg.id;
                onClose();
                if (confirm("Delete this message for everyone?")) {
                  onDeleteMessage?.(msgId);
                }
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-600 font-medium cursor-pointer transition-colors text-left"
            >
              <Trash2 className="h-4 w-4 text-rose-500" />
              <span>Delete for everyone</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
