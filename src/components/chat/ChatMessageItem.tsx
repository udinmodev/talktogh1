"use client";

import React from "react";
import { Message, User, SecuritySettings } from "@/types/chat";
import {
  Pencil,
  Trash2,
  Maximize2,
  Image as ImageIcon,
  FileText,
  Flame,
  Timer,
  Check,
  CheckCheck,
  AlertCircle,
  Pin,
} from "lucide-react";
import LinkPreviewCard, { extractUrls, formatMessageWithLinks } from "./LinkPreviewCard";
import { getBubbleRadius } from "@/lib/theme";

interface ChatMessageItemProps {
  msg: Message;
  currentUser: User;
  settings: SecuritySettings;
  theme: any;
  fontSizeClass: string;
  currentTime: number;
  activeReactionMsgId: string | null;
  setActiveReactionMsgId: (id: string | null) => void;
  quickReactions: string[];
  decryptedImages: Record<string, string>;
  isGifUrl: (text: string) => boolean;
  onAddReaction: (messageId: string, emoji: string) => void;
  onStartEdit: (msg: Message) => void;
  onDeleteMessage?: (messageId: string) => void;
  onTogglePinMessage?: (messageId: string) => void;
  onOpenImageLightbox: (url: string, name: string) => void;
  onOpenViewOnce: (msg: Message) => void;
  handleMessageContextMenu: (e: React.MouseEvent, msg: Message) => void;
  handleTouchStart: (e: React.TouchEvent, msg: Message) => void;
  handleTouchEnd: () => void;
  handleTouchMove: (e: React.TouchEvent) => void;
}

export function ChatMessageItem({
  msg,
  currentUser,
  settings,
  theme,
  fontSizeClass,
  currentTime,
  activeReactionMsgId,
  setActiveReactionMsgId,
  quickReactions,
  decryptedImages,
  isGifUrl,
  onAddReaction,
  onStartEdit,
  onDeleteMessage,
  onTogglePinMessage,
  onOpenImageLightbox,
  onOpenViewOnce,
  handleMessageContextMenu,
  handleTouchStart,
  handleTouchEnd,
  handleTouchMove,
}: ChatMessageItemProps) {
  const isMe = msg.senderId === currentUser.id;
  const bubbleRadius = getBubbleRadius(settings?.bubbleStyle || "modern", isMe);
  const isDisappearing = msg.disappearingDuration && msg.expiresAt;
  const remainingSeconds =
    isDisappearing && currentTime > 0
      ? Math.max(0, Math.ceil((msg.expiresAt! - currentTime) / 1000))
      : null;

  return (
    <div
      className={`relative flex flex-col group ${isMe ? "items-end" : "items-start"}`}
      onMouseEnter={() => setActiveReactionMsgId(msg.id)}
      onMouseLeave={() => setActiveReactionMsgId(null)}
    >
      {/* Quick Reaction & Actions Dock */}
      {activeReactionMsgId === msg.id && (
        <div
          className={`absolute -top-7 ${
            isMe ? "right-2" : "left-2"
          } bg-white border border-[#e2e8f0] rounded-full px-2 py-0.5 flex items-center gap-1 z-30 shadow-md text-[#65676b] animate-in fade-in zoom-in-95 duration-100`}
        >
          {quickReactions.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onAddReaction(msg.id, emoji)}
              className="hover:scale-125 transition-transform text-xs p-0.5 cursor-pointer"
              title="React"
            >
              {emoji}
            </button>
          ))}

          {/* Actions for current user's messages */}
          {isMe && (
            <>
              <div className="w-[1px] h-3 bg-neutral-200 mx-0.5" />
              {!msg.viewOnce && (
                <button
                  type="button"
                  onClick={() => onStartEdit(msg)}
                  className="p-1 hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 rounded-full cursor-pointer transition-colors"
                  title="Edit message"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (confirm("Delete this message for everyone?")) {
                    onDeleteMessage?.(msg.id);
                  }
                }}
                className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-600 rounded-full cursor-pointer transition-colors"
                title="Delete message"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Message Bubble */}
      <div
        onContextMenu={(e) => handleMessageContextMenu(e, msg)}
        onTouchStart={(e) => handleTouchStart(e, msg)}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        className={`relative max-w-[85%] md:max-w-[70%] ${fontSizeClass} leading-relaxed transition-all ${bubbleRadius} px-3.5 py-2 cursor-pointer ${
          isMe ? `${theme.bubbleOutgoing}` : "bg-[#f0f2f5] text-[#050505]"
        }`}
      >
        {/* Media Preview */}
        {(msg.mediaType === "image" || (!msg.mediaUrl && isGifUrl(msg.text))) && !msg.viewOnce && (
          <div className="mb-2">
            {(() => {
              const src = decryptedImages[msg.id] || msg.mediaUrl || (isGifUrl(msg.text) ? msg.text : "");
              if (src) {
                return (
                  <div
                    onClick={() => {
                      onOpenImageLightbox(
                        src,
                        msg.text === "GIF" ? "Animated GIF" : (msg.text || "Photo Attachment")
                      );
                    }}
                    className="group/img relative rounded-2xl overflow-hidden cursor-pointer shadow-xs border border-black/5 hover:opacity-95 transition-all bg-black/5"
                    title="Click to view full photo / GIF"
                  >
                    <img
                      src={src}
                      alt={msg.text || "Photo attachment"}
                      className="w-full max-h-72 object-contain rounded-2xl transition-transform duration-200 group-hover/img:scale-[1.01]"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/25 transition-colors flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                      <span className="bg-black/75 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur-xs font-medium shadow-lg">
                        <Maximize2 className="h-3.5 w-3.5" />
                        <span>Open</span>
                      </span>
                    </div>
                  </div>
                );
              }
              return (
                <div
                  className={`p-2.5 rounded-xl flex items-center gap-3 ${
                    isMe
                      ? theme.bubbleCard
                      : "bg-white/80 text-[#050505] border border-[#e4e6eb]"
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-[#0084ff]/10 text-[#0084ff] flex items-center justify-center shrink-0">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                  <div className="text-xs">
                    <div className="font-medium">{msg.text || "Media Attachment"}</div>
                    <div className={`text-[11px] ${isMe ? theme.subtle : "text-[#65676b]"}`}>
                      Loading encrypted media...
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {msg.mediaType === "doc" && !msg.viewOnce && (
          <div
            className={`mb-2 rounded-xl p-2.5 flex items-center gap-3 text-xs ${
              isMe
                ? theme.bubbleCard
                : "bg-white/80 text-[#050505] border border-[#e4e6eb]"
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-[#0084ff]/10 text-[#0084ff] flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium truncate max-w-[200px]">
                {msg.text || "Document.pdf"}
              </div>
              <div className={`text-[11px] ${isMe ? theme.subtle : "text-[#65676b]"}`}>
                Encrypted File
              </div>
            </div>
          </div>
        )}

        {msg.mediaType === "voice" && !msg.viewOnce && (
          <div
            className={`mb-2 flex items-center gap-2.5 p-2 rounded-xl ${
              isMe
                ? theme.bubbleCard
                : "bg-white/80 text-[#050505] border border-[#e4e6eb]"
            }`}
          >
            <button
              onClick={() => {
                if (msg.mediaUrl) {
                  const audio = new Audio(msg.mediaUrl);
                  audio.play();
                } else {
                  alert("Playing voice memo...");
                }
              }}
              className="w-7 h-7 rounded-full bg-[#0084ff] text-white flex items-center justify-center font-bold shrink-0 hover:bg-[#0073e6] transition-colors cursor-pointer text-xs"
              title="Play Voice Note"
            >
              ▶
            </button>
            <div className="flex-1 flex items-center gap-0.5 h-4">
              {[40, 70, 95, 50, 80, 100, 60, 40, 85, 95, 30, 85, 60, 45, 90, 65, 40].map((h, i) => (
                <div
                  key={i}
                  className={`w-0.5 rounded-full ${
                    isMe ? "bg-white/80" : "bg-[#0084ff]"
                  }`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <span className={`text-[11px] font-mono ${isMe ? theme.subtle : "text-[#65676b]"}`}>
              {msg.text.includes("(") ? msg.text.match(/\((.*?)\)/)?.[1] || "0:05" : "0:05"}
            </span>
          </div>
        )}

        {/* View-Once Message Handling */}
        {msg.viewOnce ? (
          msg.isBurned ? (
            <div
              className={`flex items-center gap-2 py-1.5 italic text-xs ${
                isMe ? "text-white/90" : "text-[#65676b]"
              }`}
            >
              <Flame className={`h-4 w-4 shrink-0 ${isMe ? "text-amber-200" : "text-amber-500"}`} />
              <span className="font-medium">View-once message opened and destroyed</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onOpenViewOnce(msg)}
              className={`flex items-center gap-2.5 py-2 px-3.5 rounded-2xl transition-all cursor-pointer font-medium text-xs shadow-xs ${
                isMe
                  ? "bg-white/20 hover:bg-white/30 text-white border border-white/20"
                  : "bg-white hover:bg-neutral-100 text-[#050505] border border-[#e4e6eb]"
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-[10px] shrink-0 shadow-xs ring-2 ring-amber-300/50">
                1
              </div>
              <div className="text-left">
                <span className="block font-semibold">
                  {msg.mediaType === "image" ? "View-once Photo" : "View-once Message"}
                </span>
                <span className={`block text-[10px] ${isMe ? "text-white/80" : "text-[#65676b]"}`}>
                  Click to open &bull; Burns after viewing
                </span>
              </div>
            </button>
          )
        ) : (
          <>
            {msg.text &&
              msg.text !== "GIF" &&
              msg.text !== msg.mediaUrl &&
              !isGifUrl(msg.text) &&
              !(msg.mediaType === "image" && /\.(jpg|jpeg|png|webp|gif)$/i.test(msg.text.trim()) && !msg.text.trim().includes(" ")) && (
                <div className="break-words mt-1">
                  {formatMessageWithLinks(msg.text, isMe)}
                </div>
              )}

            {(() => {
              if (msg.mediaType === "image" || isGifUrl(msg.text)) return null;
              const urlsInText = extractUrls(msg.text);
              if (urlsInText.length === 0) return null;
              return (
                <div className="space-y-1.5 mt-2">
                  {urlsInText.map((url, uidx) => {
                    const matchingMeta = msg.linkMetadata?.find((m) => m.url === url);
                    return (
                      <LinkPreviewCard
                        key={`${msg.id}-preview-${uidx}`}
                        url={url}
                        initialMetadata={matchingMeta}
                        isMe={isMe}
                      />
                    );
                  })}
                </div>
              );
            })()}
          </>
        )}

        {/* Reactions list */}
        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 -mb-0.5">
            {Object.entries(msg.reactions).map(([uid, emo]) => (
              <span
                key={uid}
                className={`rounded-full px-2 py-0.5 text-xs shadow-xs ${
                  isMe
                    ? "bg-black/20 text-white"
                    : "bg-white text-[#050505] border border-[#e4e6eb]"
                }`}
              >
                {emo}
              </span>
            ))}
          </div>
        )}

        {/* Message Meta Footer */}
        <div
          className={`flex items-center justify-end gap-1 mt-1 text-[11px] select-none ${
            isMe ? theme.subtle : "text-[#65676b]"
          }`}
        >
          {remainingSeconds !== null && (
            <span
              className={`flex items-center gap-0.5 text-[10px] px-1 py-0.2 rounded font-mono ${
                remainingSeconds <= 5
                  ? "bg-rose-500 text-white font-bold"
                  : isMe
                  ? "bg-black/20 text-white"
                  : "bg-white text-[#65676b] border border-[#e4e6eb]"
              }`}
            >
              <Timer className="h-3 w-3" />
              {remainingSeconds}s
            </span>
          )}

          <span>
            {new Date(msg.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {msg.isEdited && (
            <span className="text-[10px] opacity-75 italic ml-0.5">
              (edited)
            </span>
          )}

          {/* Status ticks for outgoing */}
          {isMe && (
            <span className="ml-0.5">
              {msg.status === "sending" ? (
                <span className="text-[10px]">⏱</span>
              ) : msg.status === "error" ? (
                <span
                  className="inline-flex items-center gap-0.5 text-[10px] font-bold text-white bg-rose-600 px-1.5 py-0.2 rounded-full cursor-pointer shadow-xs"
                  title="Message failed to send (Internet cut down / offline)"
                >
                  <AlertCircle className="h-2.5 w-2.5" />
                  <span>Failed</span>
                </span>
              ) : msg.status === "sent" || !settings?.readReceipts ? (
                <span title="Sent"><Check className={`h-3.5 w-3.5 ${theme.subtle}`} /></span>
              ) : msg.status === "read" ? (
                <span title="Seen"><CheckCheck className="h-3.5 w-3.5 text-cyan-300 stroke-[2.5]" /></span>
              ) : (
                <span title="Delivered"><CheckCheck className="h-3.5 w-3.5 text-white/80" /></span>
              )}
            </span>
          )}

          {/* Pin / Unpin Button */}
          {onTogglePinMessage && (
            <button
              onClick={() => onTogglePinMessage(msg.id)}
              className={`p-0.5 cursor-pointer ml-0.5 transition-opacity ${
                msg.isPinned
                  ? isMe
                    ? "text-white opacity-100"
                    : "text-[#0084ff] opacity-100"
                  : "opacity-40 hover:opacity-100"
              }`}
              title={msg.isPinned ? "Unpin message" : "Pin message"}
            >
              <Pin className={`h-3 w-3 ${msg.isPinned ? "fill-current" : ""}`} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
