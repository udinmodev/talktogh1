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
  ThumbsUp,
  Plus,
  Loader2,
  Maximize2,
  Download,
  X,
  AlertCircle,
  WifiOff,
} from "lucide-react";
import LinkPreviewCard, { extractUrls, formatMessageWithLinks } from "./LinkPreviewCard";
import { getThemeClasses, getWallpaperClass, getFontSizeClass, getBubbleRadius } from "@/lib/theme";
import { getInternalApiHeaders } from "@/lib/api-security";

interface ChatAreaProps {
  currentUser: User;
  contactUser: User;
  messages: Message[];
  settings: SecuritySettings;
  sessionKey?: CryptoKey | null;
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
  isLoading?: boolean;
  isOnline?: boolean;
  onBurnMessage?: (messageId: string) => void;
  onTogglePinMessage?: (messageId: string) => void;
}

export function ChatArea({
  currentUser,
  contactUser,
  messages,
  settings,
  sessionKey,
  isLoading = false,
  isOnline = true,
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

  // Full-screen Image Preview / Lightbox state
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Close lightbox on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPreviewImage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Clear temporary inline errors
  useEffect(() => {
    if (inlineError) {
      const timer = setTimeout(() => setInlineError(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [inlineError]);

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

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [decryptedImages, setDecryptedImages] = useState<Record<string, string>>({});

  // Client-side automatic decryption of encrypted media from ImageKit
  useEffect(() => {
    if (!sessionKey) return;
    messages.forEach(async (msg) => {
      if (msg.mediaType === "image" && msg.mediaUrl && !decryptedImages[msg.id]) {
        // If it's already a direct data URL in current memory, cache immediately
        if (msg.mediaUrl.startsWith("data:image")) {
          setDecryptedImages((prev) => ({ ...prev, [msg.id]: msg.mediaUrl! }));
          return;
        }

        // Fetch encrypted blob from ImageKit CDN
        try {
          const res = await fetch(msg.mediaUrl);
          if (res.ok) {
            const rawCiphertext = await res.text();
            let parsed: any = null;
            try {
              parsed = JSON.parse(rawCiphertext);
            } catch {
              try {
                parsed = JSON.parse(atob(rawCiphertext.trim()));
              } catch {}
            }

            if (parsed && parsed.iv && parsed.ciphertext) {
              const ivBuf = Uint8Array.from(atob(parsed.iv), (c) => c.charCodeAt(0));
              const cipherBuf = Uint8Array.from(atob(parsed.ciphertext), (c) => c.charCodeAt(0));
              const decryptedBuf = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: ivBuf },
                sessionKey,
                cipherBuf
              );
              const dataUrl = new TextDecoder().decode(decryptedBuf);
              setDecryptedImages((prev) => ({ ...prev, [msg.id]: dataUrl }));
            }
          }
        } catch (decryptErr) {
          console.warn("Could not decrypt ImageKit media blob:", decryptErr);
        }
      }
    });
  }, [messages, sessionKey, decryptedImages]);

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

    // Instant offline error check
    if (!isOnline || (typeof navigator !== "undefined" && !navigator.onLine)) {
      setInlineError("Internet connection cut down! You are offline. Message cannot be sent.");
      return;
    }

    onSendMessage(inputText.trim(), undefined, undefined, isViewOnceMode, customTimer);
    setInputText("");
    setIsViewOnceMode(false);
    setCustomTimer(null);
    setShowEmojiPicker(false);
    onTyping(false);
  };

  // Instant Optimistic Image Display + Asynchronous Background Encryption & ImageKit Upload
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      e.target.value = "";
      return;
    }

    setShowAttachMenu(false);

    // Instant offline check for media upload
    if (!isOnline || (typeof navigator !== "undefined" && !navigator.onLine)) {
      setInlineError("Internet connection cut down! Cannot upload photo while offline.");
      e.target.value = "";
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const localDataUrl = reader.result as string;
        const currentViewOnce = isViewOnceMode;
        const currentTimerVal = customTimer;

        // Reset composer inputs immediately for snappy UX
        setIsViewOnceMode(false);
        setCustomTimer(null);

        // 1. INSTANT DISPATCH: Display photo in the sender's chat UI immediately (zero latency)
        onSendMessage(file.name, "image", localDataUrl, currentViewOnce, currentTimerVal);

        // 2. BACKGROUND WORKER: Encrypt binary with AES-256-GCM and upload blob to ImageKit asynchronously
        if (sessionKey) {
          (async () => {
            try {
              const iv = window.crypto.getRandomValues(new Uint8Array(12));
              const enc = new TextEncoder();
              const encryptedBuf = await window.crypto.subtle.encrypt(
                { name: "AES-GCM", iv },
                sessionKey,
                enc.encode(localDataUrl)
              );

              const ivBase64 = btoa(String.fromCharCode(...Array.from(iv)));
              const cipherBase64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(encryptedBuf))));
              const encryptedBlobPayload = JSON.stringify({ iv: ivBase64, ciphertext: cipherBase64 });
              const payloadBase64 = btoa(encryptedBlobPayload);

              // Background upload to ImageKit
              await fetch("/api/upload", {
                method: "POST",
                headers: getInternalApiHeaders(),
                body: JSON.stringify({
                  encryptedPayloadBase64: payloadBase64,
                  filename: file.name,
                }),
              });
            } catch (bgErr) {
              console.warn("Background ImageKit encryption notice:", bgErr);
            }
          })();
        }
      };
      reader.readAsDataURL(file);
    } catch (readErr) {
      console.warn("Image file read notice:", readErr);
    }

    e.target.value = "";
  };

  const emojis = ["😀", "😂", "❤️", "🔥", "👍", "🙏", "🔒", "🛡️", "🔑", "🚀", "✨", "⚡"];
  const quickReactions = ["👍", "❤️", "🔥", "😮", "🙏"];

  return (
    <div
      className={`relative flex-1 h-full flex flex-col bg-white text-[#050505] overflow-hidden ${
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
        <div className="absolute inset-0 pointer-events-none z-10 flex flex-wrap items-center justify-around opacity-5 select-none overflow-hidden leading-loose font-mono text-xs text-slate-800 rotate-[-25deg]">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="m-8 whitespace-nowrap">
              CONFIDENTIAL // PRIVATE SESSION // {contactUser.name.toUpperCase()}
            </div>
          ))}
        </div>
      )}

      {/* Header - Facebook Messenger Clean Header */}
      <header className="h-16 px-4 md:px-6 bg-white flex items-center justify-between border-b border-[#f0f2f5] z-20 shrink-0 text-[#050505] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
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
          {/* More options menu */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
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
                <div className="p-1">
                  <button
                    onClick={onClearChat}
                    className="w-full text-left px-3 py-2 hover:bg-rose-50 rounded-xl text-rose-600 flex items-center gap-2.5 cursor-pointer transition-colors font-medium"
                  >
                    <Flame className="h-4 w-4 text-rose-600" />
                    Clear Chat History
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Offline Error Alert Banner */}
      {(!isOnline || inlineError) && (
        <div className="bg-[#fa383e] text-white px-4 py-2 flex items-center justify-between text-xs font-semibold shadow-xs z-20 shrink-0 animate-in slide-in-from-top-1">
          <div className="flex items-center gap-2 min-w-0">
            <WifiOff className="h-4 w-4 shrink-0 animate-pulse" />
            <span className="truncate">
              {inlineError || "Internet connection cut down! You are offline. Messages will not be sent."}
            </span>
          </div>
          {inlineError && (
            <button
              onClick={() => setInlineError(null)}
              className="p-1 hover:bg-white/20 rounded cursor-pointer shrink-0"
              title="Dismiss error"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Pinned Messages Banner */}
      {messages.some((m) => m.isPinned) && (
        <div className="bg-[#f0f2f5] border-b border-[#e4e6eb] px-4 py-2 flex items-center justify-between text-xs text-[#050505] z-10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Pin className="h-3.5 w-3.5 text-[#0084ff] fill-current shrink-0" />
            <span className="font-semibold text-[#050505] shrink-0">Pinned:</span>
            <span className="truncate text-[#65676b]">
              {messages.filter((m) => m.isPinned).pop()?.text}
            </span>
          </div>
          <span className="text-[11px] text-[#8a8d91] font-medium shrink-0 ml-2">
            {messages.filter((m) => m.isPinned).length} pinned
          </span>
        </div>
      )}

      {/* Message Canvas Area */}
      <div className={`flex-1 overflow-y-auto px-4 md:px-8 lg:px-16 py-6 space-y-2 bg-white relative`}>
        {/* Subtle E2EE Notice Pill */}
        <div className="flex justify-center my-3">
          <div className="max-w-sm bg-[#f0f2f5] text-[#65676b] text-xs px-4 py-1.5 rounded-full text-center flex items-center gap-1.5 select-none font-medium">
            <Lock className="h-3 w-3 text-[#0084ff] shrink-0" />
            <span className="truncate">End-to-end encrypted chat</span>
          </div>
        </div>

        {/* Date Stamp */}
        <div className="flex justify-center my-2">
          <span className="px-3 py-1 rounded-full bg-[#f0f2f5] text-[#65676b] text-[11px] font-semibold">
            Today
          </span>
        </div>

        {/* Skeleton Message Flow while loading */}
        {isLoading ? (
          <div className="space-y-4 py-4">
            {/* Incoming Bubble Skeleton */}
            <div className="flex items-end gap-2 max-w-[70%] animate-pulse">
              <div className="w-7 h-7 rounded-full bg-[#e4e6eb] shrink-0" />
              <div className="space-y-1.5">
                <div className="h-10 w-48 rounded-2xl rounded-bl-sm bg-[#f0f2f5]" />
                <div className="h-2.5 w-12 bg-[#f0f2f5] rounded-full ml-1" />
              </div>
            </div>

            {/* Outgoing Bubble Skeleton */}
            <div className="flex flex-col items-end max-w-[70%] ml-auto animate-pulse">
              <div className="h-12 w-60 rounded-2xl rounded-br-sm bg-[#0084ff]/15" />
              <div className="h-2.5 w-10 bg-[#f0f2f5] rounded-full mt-1 mr-1" />
            </div>

            {/* Incoming Longer Bubble Skeleton */}
            <div className="flex items-end gap-2 max-w-[70%] animate-pulse">
              <div className="w-7 h-7 rounded-full bg-[#e4e6eb] shrink-0" />
              <div className="space-y-1.5">
                <div className="h-16 w-64 rounded-2xl rounded-bl-sm bg-[#f0f2f5]" />
                <div className="h-2.5 w-14 bg-[#f0f2f5] rounded-full ml-1" />
              </div>
            </div>

            {/* Outgoing Media Bubble Skeleton */}
            <div className="flex flex-col items-end max-w-[70%] ml-auto animate-pulse">
              <div className="h-32 w-52 rounded-2xl rounded-br-sm bg-[#0084ff]/15" />
              <div className="h-2.5 w-12 bg-[#f0f2f5] rounded-full mt-1 mr-1" />
            </div>

            {/* Incoming Short Response Skeleton */}
            <div className="flex items-end gap-2 max-w-[70%] animate-pulse">
              <div className="w-7 h-7 rounded-full bg-[#e4e6eb] shrink-0" />
              <div className="space-y-1.5">
                <div className="h-9 w-32 rounded-2xl rounded-bl-sm bg-[#f0f2f5]" />
                <div className="h-2.5 w-10 bg-[#f0f2f5] rounded-full ml-1" />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Messenger Zero State Intro Card */}
            {messages.length === 0 && (
          <div className="py-12 px-4 flex flex-col items-center justify-center text-center max-w-md mx-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="relative mb-3">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-[#e4e6eb] ring-4 ring-[#f0f2f5]">
                <img
                  src={contactUser.avatar}
                  alt={contactUser.name}
                  className="w-full h-full object-cover"
                />
              </div>
              {contactUser.isOnline && (
                <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-[#31a24c] ring-2 ring-white" />
              )}
            </div>

            <h3 className="text-xl font-bold text-[#050505] mb-1">
              {contactUser.name}
            </h3>

            <p className="text-xs font-mono text-[#0084ff] mb-1 font-semibold">
              @{contactUser.id.replace(/@.*$/, "")}
            </p>

            <p className="text-xs text-[#65676b] leading-relaxed mb-5">
              You&apos;re connected on Messenger. Direct end-to-end encrypted conversation secured with AES-256-GCM wire cryptography.
            </p>

            {/* Messenger Wave / Say Hello Action */}
            <button
              type="button"
              onClick={() => onSendMessage("👋 Hello!")}
              className="px-6 py-2.5 rounded-full bg-[#0084ff] hover:bg-[#0073e6] active:scale-98 text-white font-semibold text-sm flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow"
            >
              <span>Say Hello 👋</span>
            </button>
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
                  } bg-white border border-[#e2e8f0] rounded-full px-2 py-0.5 flex items-center gap-1 z-30 shadow-md`}
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
                className={`relative max-w-[85%] md:max-w-[70%] ${fontSizeClass} leading-relaxed transition-all ${bubbleRadius} px-3.5 py-2 ${
                  isMe
                    ? `${theme.bubbleOutgoing}`
                    : "bg-[#f0f2f5] text-[#050505]"
                }`}
              >
                {/* Media Preview - Openable Full Lightbox */}
                {msg.mediaType === "image" && (
                  <div className="mb-2">
                    {decryptedImages[msg.id] || msg.mediaUrl ? (
                      <div
                        onClick={() => {
                          const src = decryptedImages[msg.id] || msg.mediaUrl;
                          if (src) {
                            setPreviewImage({
                              url: src,
                              name: msg.text || "Photo Attachment",
                            });
                          }
                        }}
                        className="group/img relative rounded-2xl overflow-hidden cursor-pointer shadow-xs border border-black/5 hover:opacity-95 transition-all"
                        title="Click to open photo"
                      >
                        <img
                          src={decryptedImages[msg.id] || msg.mediaUrl}
                          alt={msg.text || "Photo attachment"}
                          className="w-full max-h-72 object-cover rounded-2xl transition-transform duration-200 group-hover/img:scale-[1.02]"
                        />
                        {/* Hover Overlay Hint */}
                        <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/25 transition-colors flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                          <span className="bg-black/75 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur-xs font-medium shadow-lg">
                            <Maximize2 className="h-3.5 w-3.5" />
                            <span>Open</span>
                          </span>
                        </div>
                      </div>
                    ) : (
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
                          <div className="font-medium">{msg.text || "Photo Attachment"}</div>
                          <div className={`text-[11px] ${isMe ? theme.subtle : "text-[#65676b]"}`}>
                            Decrypting Encrypted Photo...
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

                {msg.mediaType === "voice" && (
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
                    {/* Audio Waveform visualization */}
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
                    <div className="flex items-center gap-2 py-1 italic opacity-60 text-xs text-[#65676b]">
                      <Flame className="h-4 w-4" />
                      <span>View-once message opened and destroyed</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => onBurnMessage?.(msg.id)}
                      className={`flex items-center gap-2.5 py-1.5 px-3 rounded-xl transition-all cursor-pointer font-medium text-xs ${
                        isMe
                          ? "bg-black/20 hover:bg-black/30 text-white"
                          : "bg-white hover:bg-neutral-100 text-[#050505] border border-[#e4e6eb]"
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
                  {/* Disappearing timer indicator */}
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
                      ) : msg.status === "error" ? (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] font-bold text-white bg-rose-600 px-1.5 py-0.2 rounded-full cursor-pointer shadow-xs"
                          title="Message failed to send (Internet cut down / offline)"
                        >
                          <AlertCircle className="h-2.5 w-2.5" />
                          <span>Failed</span>
                        </span>
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
        })}
          </>
        )}

        {/* Peer Typing Indicator - Messenger Animated Dots */}
        {isPeerTyping && (
          <div className="flex items-center gap-1.5 bg-[#f0f2f5] rounded-full px-4 py-2.5 max-w-[80px]">
            <span className="w-2 h-2 bg-[#65676b] rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 bg-[#65676b] rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 bg-[#65676b] rounded-full animate-bounce" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Emoji Drawer */}
      {showEmojiPicker && (
        <div className="bg-white border-t border-[#f0f2f5] p-3 grid grid-cols-6 sm:grid-cols-12 gap-1.5 max-h-36 overflow-y-auto shadow-sm">
          {emojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => setInputText((prev) => prev + emoji)}
              className="text-lg p-1.5 rounded-full hover:bg-[#f0f2f5] transition-colors cursor-pointer text-center"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Hidden Real File Input for Image Upload (Images Only) */}
      <input
        type="file"
        ref={imageInputRef}
        onChange={handleImageFileChange}
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
      />

      {/* Attachment Tray */}
      {showAttachMenu && (
        <div
          ref={attachMenuRef}
          className="absolute bottom-20 left-6 bg-white border border-[#e4e6eb] rounded-2xl p-1.5 z-30 text-xs text-[#050505] shadow-xl animate-in fade-in zoom-in-95 duration-100 min-w-[160px]"
        >
          <button
            onClick={() => {
              setShowAttachMenu(false);
              imageInputRef.current?.click();
            }}
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl hover:bg-[#f0f2f5] transition-colors cursor-pointer text-left w-full text-[#050505] font-medium"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#0084ff] flex items-center justify-center shrink-0">
              <ImageIcon className="h-4 w-4" />
            </div>
            <span>Photo</span>
          </button>
        </div>
      )}

      {/* Facebook Messenger Clean Input Bar */}
      <footer className="p-3 bg-white border-t border-[#f0f2f5] z-20 shrink-0">
        <div className="max-w-4xl mx-auto">
          {/* Detected URL Preview Pill */}
          {(() => {
            const detectedUrls = extractUrls(inputText);
            if (detectedUrls.length === 0) return null;
            return (
              <div className="mb-2 px-3.5 py-1.5 bg-[#f0f2f5] border border-[#0084ff]/30 rounded-full flex items-center justify-between text-xs text-[#0084ff] animate-in fade-in slide-in-from-bottom-2 duration-150">
                <div className="flex items-center gap-2 min-w-0">
                  <Link2 className="h-3.5 w-3.5 text-[#0084ff] shrink-0" />
                  <span className="font-semibold text-[#050505] text-[11px]">Link preview detected:</span>
                  <span className="truncate font-mono text-[11px] text-[#0084ff] max-w-[200px] sm:max-w-md">
                    {detectedUrls[0]}
                  </span>
                </div>
                <span className="text-[10.5px] text-[#65676b] font-medium shrink-0 ml-2">
                  Rich card will attach
                </span>
              </div>
            );
          })()}

          {/* Messenger Input Container */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Attachment Action Button */}
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#0084ff] hover:bg-[#f0f2f5] transition-colors cursor-pointer shrink-0"
              title="Add attachment"
            >
              <Plus className="h-5 w-5" />
            </button>

            {/* Quick Photo Upload Button */}
            <button
              type="button"
              disabled={isUploadingImage}
              onClick={() => imageInputRef.current?.click()}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#0084ff] hover:bg-[#f0f2f5] transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              title="Attach photo"
            >
              {isUploadingImage ? (
                <Loader2 className="h-5 w-5 animate-spin text-[#0084ff]" />
              ) : (
                <ImageIcon className="h-5 w-5" />
              )}
            </button>

            {/* Messenger Pill Input Container */}
            <div className="flex-1 flex items-center bg-[#f0f2f5] rounded-full px-3.5 py-1.5 focus-within:ring-2 focus-within:ring-[#0084ff]/20 transition-all">
              {/* Input Form Field */}
              <form onSubmit={handleSend} className="flex-1 flex items-center mr-1">
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
                  placeholder="Aa"
                  className="w-full bg-transparent text-[#050505] placeholder:text-[#65676b] text-sm focus:outline-none"
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
                      : "text-[#65676b] hover:text-[#050505] hover:bg-neutral-200/60"
                  }`}
                  title={customTimer !== null ? `Message timer set to ${customTimer}s` : "Set message self-destruct timer"}
                >
                  <Timer className="h-4 w-4" />
                </button>

                {showTimerMenu && (
                  <div className="absolute bottom-11 -left-12 bg-white border border-[#e4e6eb] rounded-2xl p-2 z-40 text-xs text-[#050505] shadow-xl animate-in fade-in zoom-in-95 duration-100 min-w-[140px]">
                    <div className="text-[11px] font-bold text-[#65676b] px-2 py-1 uppercase tracking-wider">
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
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                          customTimer === t.val
                            ? "bg-[#e7f3ff] text-[#0084ff] font-semibold"
                            : "hover:bg-[#f0f2f5] text-[#65676b] hover:text-[#050505]"
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
                className={`w-6 h-6 rounded-full text-[11px] font-bold transition-all cursor-pointer shrink-0 flex items-center justify-center mr-1 ${
                  isViewOnceMode
                    ? "bg-amber-500 text-white shadow-xs ring-2 ring-amber-300"
                    : "text-[#65676b] hover:text-[#050505] hover:bg-neutral-200/60 border border-[#cbd5e1]"
                }`}
                title={isViewOnceMode ? "View-Once Active (Disappears after reading)" : "Enable View-Once"}
              >
                1
              </button>

              {/* Emoji Button */}
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-1.5 text-[#0084ff] hover:bg-neutral-200/60 rounded-full transition-colors cursor-pointer shrink-0"
                title="Choose an emoji"
              >
                <Smile className="h-5 w-5" />
              </button>
            </div>

            {/* Messenger Send Button or Thumbs Up */}
            {inputText.trim() ? (
              <button
                type="button"
                onClick={() => handleSend()}
                className="w-9 h-9 rounded-full bg-[#0084ff] hover:bg-[#0073e6] text-white flex items-center justify-center font-bold shadow-xs transition-transform active:scale-95 cursor-pointer shrink-0"
                title="Send message"
              >
                <Send className="h-4 w-4 fill-current ml-0.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSendMessage("👍")}
                className="w-9 h-9 rounded-full flex items-center justify-center text-[#0084ff] hover:bg-[#f0f2f5] transition-transform active:scale-125 cursor-pointer shrink-0"
                title="Send a Thumbs Up 👍"
              >
                <ThumbsUp className="h-5 w-5 fill-[#0084ff]" />
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Full-Screen Image Lightbox Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col animate-in fade-in duration-150 select-none"
          onClick={() => setPreviewImage(null)}
        >
          {/* Lightbox Top Navigation Bar */}
          <div
            className="h-16 px-4 md:px-6 flex items-center justify-between text-white bg-black/60 border-b border-white/10 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#0084ff]/20 text-[#0084ff] flex items-center justify-center shrink-0">
                <ImageIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate text-white max-w-[200px] md:max-w-md">
                  {previewImage.name}
                </p>
                <p className="text-[11px] text-neutral-400">Encrypted Confidential Media</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={previewImage.url}
                download={previewImage.name || "confidential_photo.png"}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
                title="Download photo"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Download</span>
              </a>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-2 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Lightbox Image Stage */}
          <div
            className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-auto"
            onClick={() => setPreviewImage(null)}
          >
            <img
              src={previewImage.url}
              alt={previewImage.name}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] max-w-[92vw] object-contain rounded-xl shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}
    </div>
  );
}
