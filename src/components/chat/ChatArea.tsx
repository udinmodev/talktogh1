"use client";

import React, { useState, useRef, useEffect } from "react";
import { User, Message, SecuritySettings } from "@/types/chat";
import {
  ShieldCheck,
  Shield,
  MoreVertical,
  Paperclip,
  Smile,
  Send,
  Check,
  CheckCheck,
  Lock,
  Timer,
  ArrowLeft,
  Flame,
  FileText,
  Image as ImageIcon,
  KeyRound,
  Eye,
  Pin,
  PinOff,
  Link2,
  Globe,
} from "lucide-react";
import LinkPreviewCard, { extractUrls, formatMessageWithLinks } from "./LinkPreviewCard";
import { getThemeClasses, getWallpaperClass, getFontSizeClass, getBubbleRadius } from "@/lib/theme";

interface ChatAreaProps {
  currentUser: User;
  contactUser: User;
  messages: Message[];
  settings: SecuritySettings;
  onSendMessage: (
    text: string,
    mediaType?: "image" | "voice" | "doc",
    mediaUrl?: string,
    viewOnce?: boolean,
    customDuration?: number | null
  ) => void;
  onOpenSafetyNumbers: () => void;
  onOpenSecurityCenter: () => void;
  onBackMobile: () => void;
  onAddReaction: (messageId: string, emoji: string) => void;
  onClearChat: () => void;
  onTyping: (isTyping: boolean) => void;
  isPeerTyping: boolean;
  onBurnMessage?: (messageId: string) => void;
  onTogglePinMessage?: (messageId: string) => void;
}

export function ChatArea({
  currentUser,
  contactUser,
  messages,
  settings,
  onSendMessage,
  onOpenSafetyNumbers,
  onOpenSecurityCenter,
  onBackMobile,
  onAddReaction,
  onClearChat,
  onTyping,
  isPeerTyping,
  onBurnMessage,
  onTogglePinMessage,
}: ChatAreaProps) {
  const theme = getThemeClasses(settings?.themeColor || "emerald");
  const wallpaperClass = getWallpaperClass(settings?.chatWallpaper || "default");
  const fontSizeClass = getFontSizeClass(settings?.fontSize || "medium");

  const [inputText, setInputText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isViewOnceMode, setIsViewOnceMode] = useState(false);
  const [customTimer, setCustomTimer] = useState<number | null>(null);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);

  // Real File Upload Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Event-Driven countdown active only when disappearing messages exist
  useEffect(() => {
    const hasDisappearing = messages.some((m) => m.expiresAt);
    if (!hasDisappearing) {
      setCurrentTime(Date.now());
      return;
    }

    setCurrentTime(Date.now());
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [messages]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPeerTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    onTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 1500);
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim(), undefined, undefined, isViewOnceMode, customTimer);
    setInputText("");
    setIsViewOnceMode(false);
    setCustomTimer(null);
    setShowEmojiPicker(false);
    onTyping(false);
  };

  // Real Image Upload
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onSendMessage(file.name, "image", dataUrl, isViewOnceMode, customTimer);
      setIsViewOnceMode(false);
      setCustomTimer(null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
    setShowAttachMenu(false);
  };

  // Real Document Upload
  const handleDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onSendMessage(file.name, "doc", dataUrl, isViewOnceMode, customTimer);
      setIsViewOnceMode(false);
      setCustomTimer(null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
    setShowAttachMenu(false);
  };

  const emojis = ["😀", "😂", "❤️", "🔥", "👍", "🙏", "🔒", "🛡️", "🔑", "🚀", "✨", "⚡"];
  const quickReactions = ["👍", "❤️", "🔥", "😮", "🙏"];

  return (
    <div
      className={`relative flex-1 h-full flex flex-col bg-slate-50 overflow-hidden ${
        settings.preventCopyForward ? "select-none" : ""
      }`}
      onContextMenu={(e) => {
        if (settings.preventCopyForward) {
          e.preventDefault();
        }
      }}
    >
      {/* Watermark Overlay */}
      {settings.antiScreenshotWatermark && (
        <div className="absolute inset-0 pointer-events-none z-10 flex flex-wrap items-center justify-around opacity-5 select-none overflow-hidden leading-loose font-mono text-xs text-slate-900 rotate-[-25deg]">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="m-8 whitespace-nowrap">
              CONFIDENTIAL // PRIVATE SESSION // {contactUser.name.toUpperCase()}
            </div>
          ))}
        </div>
      )}

      {/* Header - Modern Flat Messenger Navigation */}
      <header className="h-16 px-4 md:px-6 bg-white flex items-center justify-between border-b border-slate-100 z-20 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Back Button */}
          <button
            onClick={onBackMobile}
            className="md:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            title="Back to chats"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Contact Avatar */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200">
              <img
                src={contactUser.avatar}
                alt={contactUser.name}
                className="w-full h-full object-cover"
              />
            </div>
            {contactUser.isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            )}
          </div>

          {/* Contact Details & Status */}
          <div className="flex flex-col min-w-0 justify-center">
            <span className="font-semibold text-sm sm:text-base text-slate-900 tracking-tight truncate leading-tight">
              {contactUser.name}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5 leading-tight">
              {isPeerTyping ? (
                <span className="text-blue-600 font-medium text-xs animate-pulse">
                  typing...
                </span>
              ) : (
                <span className="text-slate-400 text-xs">
                  {contactUser.isOnline ? "Online" : "Offline"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-0.5">
          {/* More options menu */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <MoreVertical className="h-5 w-5" />
            </button>

            {showMoreMenu && (
              <div
                className="absolute right-0 top-12 w-52 bg-white border border-slate-200/90 rounded-2xl p-1.5 z-50 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-100"
                onClick={() => setShowMoreMenu(false)}
              >
                <div className="p-1 space-y-0.5">
                  <button
                    onClick={onOpenSecurityCenter}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-xl flex items-center gap-2.5 cursor-pointer text-slate-800 font-medium transition-colors"
                  >
                    <Shield className="h-4 w-4 text-slate-500" />
                    Security Settings
                  </button>
                </div>
                <div className="p-1">
                  <button
                    onClick={onClearChat}
                    className="w-full text-left px-3 py-2 hover:bg-rose-50 rounded-xl text-rose-600 flex items-center gap-2.5 cursor-pointer transition-colors font-medium"
                  >
                    <Flame className="h-4 w-4 text-rose-500" />
                    Clear Chat History
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Pinned Messages Banner */}
      {messages.some((m) => m.isPinned) && (
        <div className="bg-slate-100/90 border-b border-slate-200/80 px-4 py-2 flex items-center justify-between text-xs text-slate-700 z-10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Pin className="h-3.5 w-3.5 text-blue-600 fill-current shrink-0" />
            <span className="font-semibold text-slate-800 shrink-0">Pinned:</span>
            <span className="truncate text-slate-600">
              {messages.filter((m) => m.isPinned).pop()?.text}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium shrink-0 ml-2">
            {messages.filter((m) => m.isPinned).length} pinned
          </span>
        </div>
      )}

      {/* Message Canvas Area */}
      <div className={`flex-1 overflow-y-auto px-4 md:px-8 lg:px-16 py-6 space-y-2 ${wallpaperClass} relative`}>
        {/* Subtle E2EE Notice Pill */}
        <div className="flex justify-center my-3">
          <div className="max-w-sm bg-slate-200/50 text-slate-500 text-xs px-3.5 py-1 rounded-full text-center flex items-center gap-1.5 select-none">
            <Lock className="h-3 w-3 text-slate-400 shrink-0" />
            <span className="truncate">Messages are end-to-end encrypted</span>
          </div>
        </div>

        {/* Date Stamp */}
        <div className="flex justify-center my-2">
          <span className="text-slate-400 text-xs font-medium">
            Today
          </span>
        </div>

        {/* Zero State Intro Card when no messages yet */}
        {messages.length === 0 && (
          <div className="py-12 px-4 flex flex-col items-center justify-center text-center max-w-md mx-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mb-3">
              {contactUser.isPublicChannel ? (
                <Globe className="h-8 w-8 text-blue-500" />
              ) : (
                <ShieldCheck className="h-8 w-8 text-emerald-500" />
              )}
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-1">
              {contactUser.name}
            </h3>

            <p className="text-xs font-mono text-slate-500 mb-2">
              {contactUser.isPublicChannel ? contactUser.phone : `@${contactUser.id}`}
            </p>

            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              {contactUser.isPublicChannel
                ? contactUser.about
                : `Direct confidential conversation with @${contactUser.id}. Messages are zero-knowledge encrypted and secured with AES-256 wire cryptography.`}
            </p>

            {/* 7 Message Types Quick Action Starters */}
            <div className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Available Public Chat Features (7 Types)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => onSendMessage("👋 Hello! Secure connection established.")}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>💬</span>
                  <span className="truncate">Say Hello</span>
                </button>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>📷</span>
                  <span className="truncate">Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>📄</span>
                  <span className="truncate">Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSendMessage("⏱️ Confidential update with auto self-destruct.", undefined, undefined, false, 30)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>⏱️</span>
                  <span className="truncate">30s Expire</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSendMessage("👁️ View-once secret note: burned upon reading.", undefined, undefined, true, null)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>👁️</span>
                  <span className="truncate">View Once</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSendMessage("Verified reference: https://github.com")}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>🔗</span>
                  <span className="truncate">Rich Link</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Message Stream */}
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser.id;
          const bubbleRadius = getBubbleRadius(settings?.bubbleStyle || "modern", isMe);
          const isDisappearing = msg.disappearingDuration && msg.expiresAt;
          const remainingSeconds =
            isDisappearing && currentTime > 0
              ? Math.max(0, Math.ceil((msg.expiresAt! - currentTime) / 1000))
              : null;

          return (
            <div
              key={msg.id}
              className={`relative flex flex-col group ${isMe ? "items-end" : "items-start"}`}
              onMouseEnter={() => setActiveReactionMsgId(msg.id)}
              onMouseLeave={() => setActiveReactionMsgId(null)}
            >
              {/* Quick Reaction Dock */}
              {activeReactionMsgId === msg.id && (
                <div
                  className={`absolute -top-7 ${
                    isMe ? "right-2" : "left-2"
                  } bg-white border border-slate-200 rounded-full px-2 py-0.5 flex items-center gap-1 z-30`}
                >
                  {quickReactions.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => onAddReaction(msg.id, emoji)}
                      className="hover:scale-125 transition-transform text-xs p-0.5 cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {/* Natural Messenger Bubble */}
              <div
                className={`relative max-w-[85%] md:max-w-[70%] ${fontSizeClass} leading-relaxed transition-colors ${bubbleRadius} px-4 py-2.5 ${
                  isMe
                    ? `${theme.bubbleOutgoing}`
                    : "bg-white text-slate-900 border border-slate-200/80 shadow-xs"
                }`}
              >
                {/* Media Preview */}
                {msg.mediaType === "image" && (
                  <div className="mb-2 rounded-xl overflow-hidden">
                    {msg.mediaUrl ? (
                      <img
                        src={msg.mediaUrl}
                        alt="Photo attachment"
                        className="w-full max-h-64 object-cover rounded-xl"
                      />
                    ) : (
                      <div
                        className={`p-2.5 rounded-xl flex items-center gap-3 ${
                          isMe
                            ? theme.bubbleCard
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                        <div className="text-xs">
                          <div className="font-medium">{msg.text || "Photo Attachment"}</div>
                          <div className={`text-[11px] ${isMe ? theme.subtle : "text-slate-400"}`}>
                            Photo
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {msg.mediaType === "doc" && (
                  <div
                    className={`mb-2 rounded-xl p-2.5 flex items-center gap-3 text-xs ${
                      isMe
                        ? theme.bubbleCard
                        : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium truncate max-w-[200px]">
                        {msg.text || "Document.pdf"}
                      </div>
                      <div className={`text-[11px] ${isMe ? theme.subtle : "text-slate-400"}`}>
                        Encrypted File
                      </div>
                    </div>
                  </div>
                )}

                {msg.mediaType === "voice" && (
                  <div
                    className={`mb-2 flex items-center gap-2.5 p-2 rounded-xl ${
                      isMe
                        ? theme.bubbleCard
                        : "bg-slate-100 text-slate-800"
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
                      className="w-7 h-7 rounded-full bg-white text-slate-900 flex items-center justify-center font-bold shrink-0 hover:bg-slate-100 transition-colors cursor-pointer text-xs"
                      title="Play Voice Note"
                    >
                      ▶
                    </button>
                    {/* Audio Waveform visualization */}
                    <div className="flex-1 flex items-center gap-0.5 h-4">
                      {[40, 70, 95, 50, 80, 100, 60, 40, 85, 95, 30, 85, 60, 45, 90, 65, 40].map((h, i) => (
                        <div
                          key={i}
                          className={`w-0.5 rounded-full ${
                            isMe ? "bg-white/80" : "bg-slate-500"
                          }`}
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                    <span className={`text-[11px] font-mono ${isMe ? theme.subtle : "text-slate-400"}`}>
                      {msg.text.includes("(") ? msg.text.match(/\((.*?)\)/)?.[1] || "0:05" : "0:05"}
                    </span>
                  </div>
                )}

                {/* View-Once Message Handling */}
                {msg.viewOnce ? (
                  msg.isBurned ? (
                    <div className="flex items-center gap-2 py-1 italic opacity-60 text-xs">
                      <Flame className="h-4 w-4" />
                      <span>View-once message opened and destroyed</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => onBurnMessage?.(msg.id)}
                      className={`flex items-center gap-2.5 py-1.5 px-3 rounded-xl transition-all cursor-pointer font-medium text-xs ${
                        isMe
                          ? "bg-black/20 hover:bg-black/30 text-white"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-[10px]">
                        1
                      </div>
                      <span>Click to view (Burns immediately)</span>
                    </button>
                  )
                ) : (
                  <>
                    {/* Message Text with interactive links */}
                    <div className="break-words">
                      {formatMessageWithLinks(msg.text, isMe)}
                    </div>

                    {/* Rich Link Metadata Previews */}
                    {(() => {
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
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          isMe
                            ? "bg-black/20 text-white"
                            : "bg-slate-100 text-slate-800 border border-slate-200"
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
                    isMe ? theme.subtle : "text-slate-400"
                  }`}
                >
                  {/* Disappearing timer indicator */}
                  {remainingSeconds !== null && (
                    <span
                      className={`flex items-center gap-0.5 text-[10px] px-1 py-0.2 rounded font-mono ${
                        remainingSeconds <= 5
                          ? "bg-rose-500 text-white font-bold"
                          : isMe
                          ? "bg-black/25 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      <Timer className="h-3 w-3" />
                      {remainingSeconds}s
                    </span>
                  )}

                  {/* Timestamp */}
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>

                  {/* Status ticks for outgoing */}
                  {isMe && (
                    <span className="ml-0.5">
                      {msg.status === "sending" ? (
                        <span className="text-[10px]">⏱</span>
                      ) : msg.status === "sent" || !settings?.readReceipts ? (
                        <Check className={`h-3.5 w-3.5 ${theme.subtle}`} />
                      ) : (
                        <CheckCheck className="h-3.5 w-3.5 text-white" />
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
                            : "text-blue-600 opacity-100"
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
        })}

        {/* Peer Typing Indicator */}
        {isPeerTyping && (
          <div className={`flex items-center gap-1.5 bg-white border border-slate-200/80 ${getBubbleRadius(settings?.bubbleStyle || "modern", false)} px-4 py-2.5 max-w-[80px]`}>
            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Emoji Drawer */}
      {showEmojiPicker && (
        <div className="bg-white border-t border-slate-100 p-3 grid grid-cols-6 sm:grid-cols-12 gap-1.5 max-h-36 overflow-y-auto">
          {emojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => setInputText((prev) => prev + emoji)}
              className="text-lg p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer text-center"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Hidden Real File Inputs for Image & Document Upload */}
      <input
        type="file"
        ref={imageInputRef}
        onChange={handleImageFileChange}
        accept="image/*,video/*"
        className="hidden"
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleDocFileChange}
        accept=".pdf,.doc,.docx,.txt,.zip"
        className="hidden"
      />

      {/* Attachment Tray */}
      {showAttachMenu && (
        <div
          ref={attachMenuRef}
          className="absolute bottom-20 left-6 bg-white border border-slate-200/90 rounded-2xl p-1.5 z-30 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100"
        >
          <button
            onClick={() => {
              setShowAttachMenu(false);
              imageInputRef.current?.click();
            }}
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer text-left w-full text-slate-700 hover:text-slate-900 font-medium"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <ImageIcon className="h-4 w-4" />
            </div>
            <span>Photo & Video</span>
          </button>
          <button
            onClick={() => {
              setShowAttachMenu(false);
              fileInputRef.current?.click();
            }}
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer text-left w-full text-slate-700 hover:text-slate-900 font-medium"
          >
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <span>Document</span>
          </button>
        </div>
      )}

      {/* Unified Seamless Input Bar - Same bg as main canvas, unified connected field */}
      <footer className="p-3 bg-[#f8f9fa] z-20 shrink-0">
        <div className="max-w-4xl mx-auto">
          {/* Detected URL Preview Pill */}
          {(() => {
            const detectedUrls = extractUrls(inputText);
            if (detectedUrls.length === 0) return null;
            return (
              <div className="mb-2 px-3 py-1.5 bg-blue-50/90 border border-blue-200/90 rounded-2xl flex items-center justify-between text-xs text-blue-900 animate-in fade-in slide-in-from-bottom-2 duration-150">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Link2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <span className="font-semibold text-blue-800 text-[11px]">Link preview detected:</span>
                  <span className="truncate font-mono text-[11px] text-blue-600 max-w-[200px] sm:max-w-md">
                    {detectedUrls[0]}
                  </span>
                </div>
                <span className="text-[10px] text-blue-500 font-medium shrink-0 ml-2">
                  Rich card will attach
                </span>
              </div>
            );
          })()}

          {/* Single Connected Pill Input Container */}
          <div className={`flex items-center bg-white border border-slate-200/90 rounded-full px-2 py-1.5 ${theme.ring} focus-within:ring-1 transition-all`}>
            {/* Connected Attachment / Upload Icon */}
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className={`p-2 rounded-full transition-colors cursor-pointer shrink-0 ${
                showAttachMenu
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
              }`}
              title="Attach photo or document"
            >
              <Paperclip className="h-5 w-5" />
            </button>

            {/* Input Form Field */}
            <form onSubmit={handleSend} className="flex-1 flex items-center px-2">
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    if (settings?.enterToSend === false) {
                      e.preventDefault();
                    }
                  }
                }}
                placeholder="Message..."
                className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none"
              />
            </form>

            {/* Per-Message Custom Self-Destruct Timer Toggle */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTimerMenu(!showTimerMenu)}
                className={`p-1.5 rounded-full text-xs font-mono transition-all cursor-pointer shrink-0 flex items-center justify-center mr-0.5 ${
                  customTimer !== null
                    ? "bg-rose-500 text-white font-bold ring-2 ring-rose-300"
                    : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                }`}
                title={customTimer !== null ? `Message timer set to ${customTimer}s` : "Set message self-destruct timer"}
              >
                <Timer className="h-4 w-4" />
              </button>

              {showTimerMenu && (
                <div className="absolute bottom-10 -left-12 bg-white border border-slate-200/90 rounded-2xl p-2 z-40 text-xs text-slate-700 shadow-sm animate-in fade-in zoom-in-95 duration-100 min-w-[140px]">
                  <div className="text-[11px] font-semibold text-slate-500 px-2 py-1 uppercase tracking-wider">
                    Self-Destruct
                  </div>
                  {[
                    { label: "Default", val: null },
                    { label: "5 seconds", val: 5 },
                    { label: "10 seconds", val: 10 },
                    { label: "30 seconds", val: 30 },
                    { label: "1 minute", val: 60 },
                    { label: "1 hour", val: 3600 },
                  ].map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => {
                        setCustomTimer(t.val);
                        setShowTimerMenu(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                        customTimer === t.val
                          ? "bg-slate-900 text-white"
                          : "hover:bg-slate-100 text-slate-700"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* View-Once Security Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsViewOnceMode(!isViewOnceMode)}
              className={`w-7 h-7 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center justify-center mr-0.5 ${
                isViewOnceMode
                  ? "bg-amber-500 text-white shadow-sm ring-2 ring-amber-300"
                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-50 border border-slate-200"
              }`}
              title={isViewOnceMode ? "View-Once Active (Disappears after reading)" : "Enable View-Once"}
            >
              1
            </button>

            {/* Emoji Button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-full transition-colors cursor-pointer shrink-0"
              title="Emojis"
            >
              <Smile className="h-5 w-5" />
            </button>

            {/* Send Button */}
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!inputText.trim()}
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors cursor-pointer shrink-0 ml-1 ${
                inputText.trim()
                  ? `${theme.bg} ${theme.hoverBg} text-white cursor-pointer`
                  : "bg-slate-100 text-slate-300 cursor-not-allowed"
              }`}
              title="Send message"
            >
              <Send className="h-4 w-4 fill-current ml-0.5" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
