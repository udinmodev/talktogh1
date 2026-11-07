"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { User, Message, SecuritySettings } from "@/types/chat";
import {
  Lock,
  Pin,
  Loader2,
  X,
  WifiOff,
  Flame,
  ImageIcon,
  Download,
} from "lucide-react";
import LinkPreviewCard, { extractUrls, formatMessageWithLinks } from "./LinkPreviewCard";
import { getThemeClasses, getWallpaperClass, getFontSizeClass } from "@/lib/theme";
import { base64ToBuffer } from "@/lib/crypto";
import { ChatHeader } from "./ChatHeader";
import { ChatMessageItem } from "./ChatMessageItem";
import { ChatMessageContextMenu } from "./ChatMessageContextMenu";
import { ChatInputBar, AttachedMedia } from "./ChatInputBar";
import { ChatMediaModals } from "./ChatMediaModals";

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
  hasMoreMessages?: boolean;
  isLoadingMoreMessages?: boolean;
  onLoadMoreMessages?: () => void;
  isOnline?: boolean;
  onBurnMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, newText: string) => void;
  onTogglePinMessage?: (messageId: string) => void;
}

export function ChatArea({
  currentUser,
  contactUser,
  messages,
  settings,
  sessionKey,
  isLoading = false,
  hasMoreMessages = false,
  isLoadingMoreMessages = false,
  onLoadMoreMessages,
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
  onDeleteMessage,
  onEditMessage,
  onTogglePinMessage,
}: ChatAreaProps) {
  const theme = getThemeClasses(settings?.themeColor || "emerald");
  const fontSizeClass = getFontSizeClass(settings?.fontSize || "medium");

  const [inputText, setInputText] = useState("");
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isViewOnceMode, setIsViewOnceMode] = useState(false);
  const [customTimer, setCustomTimer] = useState<number | null>(null);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);

  // Full-screen Image Preview / Lightbox state
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  // View-Once Confidential Modal state
  const [activeViewOnceMsg, setActiveViewOnceMsg] = useState<Message | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [attachedMedia, setAttachedMedia] = useState<AttachedMedia | null>(null);

  // Context Menu Dropdown state (for right-click and long-press)
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    message: Message;
  } | null>(null);

  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleMessageContextMenu = (e: React.MouseEvent, msg: Message) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 280);
    setContextMenu({
      x: Math.max(10, x),
      y: Math.max(10, y),
      message: msg,
    });
  };

  const handleTouchStart = (e: React.TouchEvent, msg: Message) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(40);
        } catch {}
      }
      const x = Math.min(touch.clientX, window.innerWidth - 220);
      const y = Math.min(touch.clientY, window.innerHeight - 280);
      setContextMenu({
        x: Math.max(10, x),
        y: Math.max(10, y),
        message: msg,
      });
    }, 450);
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
    }
  };

  // Close lightbox, context menu, cancel edit, or View-Once modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (contextMenu) {
          setContextMenu(null);
        } else if (attachedMedia) {
          setAttachedMedia(null);
        } else if (editingMessage) {
          setEditingMessage(null);
          setInputText("");
        } else if (activeViewOnceMsg) {
          const id = activeViewOnceMsg.id;
          setActiveViewOnceMsg(null);
          onBurnMessage?.(id);
        } else if (previewImage) {
          setPreviewImage(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [contextMenu, editingMessage, activeViewOnceMsg, previewImage, onBurnMessage]);

  // Dismiss context menu on click or scroll outside
  useEffect(() => {
    const handleDismiss = () => {
      setContextMenu(null);
    };
    window.addEventListener("click", handleDismiss);
    window.addEventListener("scroll", handleDismiss, true);
    return () => {
      window.removeEventListener("click", handleDismiss);
      window.removeEventListener("scroll", handleDismiss, true);
    };
  }, []);

  // Clear temporary inline errors
  useEffect(() => {
    if (inlineError) {
      const timer = setTimeout(() => setInlineError(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [inlineError]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
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

  // Scroll metrics for older messages prepending
  const prevScrollHeightRef = useRef<number>(0);
  const prevScrollTopRef = useRef<number>(0);
  const isPrependingOlderRef = useRef<boolean>(false);

  const scrollToBottom = (smooth = true) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  };

  useLayoutEffect(() => {
    if (isPrependingOlderRef.current && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const heightDiff = container.scrollHeight - prevScrollHeightRef.current;
      container.scrollTop = prevScrollTopRef.current + heightDiff;
      isPrependingOlderRef.current = false;
    }
  }, [messages]);

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (
      container.scrollTop < 80 &&
      hasMoreMessages &&
      !isLoadingMoreMessages &&
      onLoadMoreMessages
    ) {
      prevScrollHeightRef.current = container.scrollHeight;
      prevScrollTopRef.current = container.scrollTop;
      isPrependingOlderRef.current = true;
      onLoadMoreMessages();
    }
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [contactUser?.id]);

  useEffect(() => {
    if (isPrependingOlderRef.current) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 250;
    if (isNearBottom || isPeerTyping) {
      scrollToBottom(true);
    }
  }, [messages, isPeerTyping]);

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [decryptedImages, setDecryptedImages] = useState<Record<string, string>>({});

  // Client-side automatic decryption of encrypted media from ImageKit
  useEffect(() => {
    if (!sessionKey) return;
    messages.forEach(async (msg) => {
      if (msg.mediaType === "image" && msg.mediaUrl && !decryptedImages[msg.id]) {
        if (msg.mediaUrl.startsWith("data:image")) {
          setDecryptedImages((prev) => ({ ...prev, [msg.id]: msg.mediaUrl! }));
          return;
        }

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
              const ivBuf = new Uint8Array(base64ToBuffer(parsed.iv));
              const cipherBuf = base64ToBuffer(parsed.ciphertext);
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

  const isGifUrl = (text: string): boolean => {
    if (!text || typeof text !== "string") return false;
    const trimmed = text.trim();
    if (!/^https?:\/\//i.test(trimmed)) return false;
    if (/\s/.test(trimmed)) return false;

    if (/\.(gif|webp)(\?.*)?$/i.test(trimmed)) return true;
    if (/(media|c|t)\.tenor\.com\//i.test(trimmed)) return true;
    if (/tenor\.com\/view\//i.test(trimmed)) return true;
    if (/(media[0-9]*|i)\.giphy\.com\//i.test(trimmed)) return true;
    if (/giphy\.com\/gifs\//i.test(trimmed)) return true;

    return false;
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!isOnline || (typeof navigator !== "undefined" && !navigator.onLine)) {
      setInlineError("Internet connection cut down! You are offline. Message cannot be sent.");
      return;
    }

    const trimmed = inputText.trim();

    // 1. If an image/photo/GIF is staged, send it WITH the user's typed caption text!
    if (attachedMedia) {
      const captionText = trimmed || (attachedMedia.isGif ? "GIF" : attachedMedia.name);
      onSendMessage(
        captionText,
        "image",
        attachedMedia.dataUrl,
        isViewOnceMode,
        customTimer
      );
      setAttachedMedia(null);
      setInputText("");
      setIsViewOnceMode(false);
      setCustomTimer(null);
      setShowEmojiPicker(false);
      onTyping(false);
      return;
    }

    // 2. Otherwise require non-empty text
    if (!trimmed) return;

    if (editingMessage) {
      onEditMessage?.(editingMessage.id, trimmed);
      setEditingMessage(null);
      setInputText("");
      onTyping(false);
      return;
    }

    if (isGifUrl(trimmed)) {
      onSendMessage("GIF", "image", trimmed, isViewOnceMode, customTimer);
      setInputText("");
      setIsViewOnceMode(false);
      setCustomTimer(null);
      setShowEmojiPicker(false);
      onTyping(false);
      return;
    }

    onSendMessage(trimmed, undefined, undefined, isViewOnceMode, customTimer);
    setInputText("");
    setIsViewOnceMode(false);
    setCustomTimer(null);
    setShowEmojiPicker(false);
    onTyping(false);
  };

  const processImageOrGifFile = async (
    file: File
  ): Promise<{ dataUrl: string; name: string }> => {
    const isGif = file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");

    if (isGif) {
      if (file.size > 4 * 1024 * 1024) {
        throw new Error(
          `GIF size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds 4MB limit. Please choose a smaller GIF.`
        );
      }
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve({
            dataUrl: reader.result as string,
            name: file.name || "animation.gif",
          });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    if (file.size <= 350 * 1024) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve({
            dataUrl: reader.result as string,
            name: file.name,
          });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 1280;
          let { width, height } = img;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve({ dataUrl: reader.result as string, name: file.name });
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.82);
          const cleanName = (file.name || "photo").replace(/\.[^/.]+$/, "") + ".jpg";
          resolve({ dataUrl: compressedDataUrl, name: cleanName });
        };
        img.onerror = () => {
          resolve({ dataUrl: reader.result as string, name: file.name });
        };
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const stageImageOrGifFile = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.name.toLowerCase().endsWith(".gif")) {
      setInlineError("Please select a valid image or GIF file.");
      return;
    }

    if (!isOnline || (typeof navigator !== "undefined" && !navigator.onLine)) {
      setInlineError("Internet connection cut down! Cannot upload photo while offline.");
      return;
    }

    setIsUploadingImage(true);
    setInlineError(null);
    setShowAttachMenu(false);

    try {
      const { dataUrl, name } = await processImageOrGifFile(file);
      const isGif = file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");
      setAttachedMedia({ dataUrl, name, isGif });
    } catch (err: any) {
      console.warn("Image/GIF process error:", err);
      setInlineError(err.message || "Failed to load image or GIF.");
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await stageImageOrGifFile(file);
    }
    e.target.value = "";
  };

  const handleInputPaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            await stageImageOrGifFile(file);
            return;
          }
        }
      }
    }

    const textData = e.clipboardData?.getData("text/plain")?.trim();
    if (textData && isGifUrl(textData)) {
      e.preventDefault();
      setAttachedMedia({ dataUrl: textData, name: "Animated GIF", isGif: true });
      return;
    }
  };

  const emojis = ["😀", "😂", "❤️", "🔥", "👍", "🙏", "🔒", "🛡️", "🔑", "🚀", "✨", "⚡"];
  const quickReactions = ["👍", "❤️", "🔥", "😮", "🙏"];

  return (
    <div
      className={`relative flex-1 h-full min-h-0 flex flex-col bg-white text-[#050505] overflow-hidden ${
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

      {/* Header */}
      <ChatHeader
        contactUser={contactUser}
        isPeerTyping={isPeerTyping}
        onBackMobile={onBackMobile}
        onOpenSecurityCenter={onOpenSecurityCenter}
        onClearChat={onClearChat}
        showMoreMenu={showMoreMenu}
        setShowMoreMenu={setShowMoreMenu}
        moreMenuRef={moreMenuRef}
      />

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
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 lg:px-16 py-6 space-y-2 bg-white relative overscroll-contain"
      >
        {/* Loading Older Messages Spinner */}
        {isLoadingMoreMessages && (
          <div className="flex justify-center py-2 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f0f2f5] text-[#65676b] text-xs font-medium shadow-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0084ff]" />
              <span>Loading older messages...</span>
            </div>
          </div>
        )}

        {/* E2EE Notice Pill */}
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
        {isLoading && messages.length === 0 ? (
          <div className="space-y-4 py-4">
            <div className="flex items-end gap-2 max-w-[70%] animate-pulse">
              <div className="w-7 h-7 rounded-full bg-[#e4e6eb] shrink-0" />
              <div className="space-y-1.5">
                <div className="h-10 w-48 rounded-2xl rounded-bl-sm bg-[#f0f2f5]" />
                <div className="h-2.5 w-12 bg-[#f0f2f5] rounded-full ml-1" />
              </div>
            </div>
            <div className="flex flex-col items-end max-w-[70%] ml-auto animate-pulse">
              <div className="h-12 w-60 rounded-2xl rounded-br-sm bg-[#0084ff]/15" />
              <div className="h-2.5 w-10 bg-[#f0f2f5] rounded-full mt-1 mr-1" />
            </div>
            <div className="flex items-end gap-2 max-w-[70%] animate-pulse">
              <div className="w-7 h-7 rounded-full bg-[#e4e6eb] shrink-0" />
              <div className="space-y-1.5">
                <div className="h-16 w-64 rounded-2xl rounded-bl-sm bg-[#f0f2f5]" />
                <div className="h-2.5 w-14 bg-[#f0f2f5] rounded-full ml-1" />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Zero State Intro Card */}
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
                  You&apos;re connected on TalkTogether. Direct end-to-end encrypted conversation secured with AES-256-GCM wire cryptography.
                </p>

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
            {messages.map((msg) => (
              <ChatMessageItem
                key={msg.id}
                msg={msg}
                currentUser={currentUser}
                settings={settings}
                theme={theme}
                fontSizeClass={fontSizeClass}
                currentTime={currentTime}
                activeReactionMsgId={activeReactionMsgId}
                setActiveReactionMsgId={setActiveReactionMsgId}
                quickReactions={quickReactions}
                decryptedImages={decryptedImages}
                isGifUrl={isGifUrl}
                onAddReaction={onAddReaction}
                onStartEdit={(m) => {
                  setEditingMessage(m);
                  setInputText(m.text);
                }}
                onDeleteMessage={onDeleteMessage}
                onTogglePinMessage={onTogglePinMessage}
                onOpenImageLightbox={(url, name) => setPreviewImage({ url, name })}
                onOpenViewOnce={(m) => setActiveViewOnceMsg(m)}
                handleMessageContextMenu={handleMessageContextMenu}
                handleTouchStart={handleTouchStart}
                handleTouchEnd={handleTouchEnd}
                handleTouchMove={handleTouchMove}
              />
            ))}
          </>
        )}

        {/* Peer Typing Indicator */}
        {isPeerTyping && (
          <div className="flex items-center gap-1.5 bg-[#f0f2f5] rounded-full px-4 py-2.5 max-w-[80px]">
            <span className="w-2 h-2 bg-[#65676b] rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 bg-[#65676b] rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 bg-[#65676b] rounded-full animate-bounce" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={imageInputRef}
        onChange={handleImageFileChange}
        accept="image/*,image/gif"
        className="hidden"
      />

      {/* Input Bar */}
      <ChatInputBar
        attachedMedia={attachedMedia}
        setAttachedMedia={setAttachedMedia}
        inputText={inputText}
        setInputText={setInputText}
        editingMessage={editingMessage}
        setEditingMessage={setEditingMessage}
        showEmojiPicker={showEmojiPicker}
        setShowEmojiPicker={setShowEmojiPicker}
        showAttachMenu={showAttachMenu}
        setShowAttachMenu={setShowAttachMenu}
        isViewOnceMode={isViewOnceMode}
        setIsViewOnceMode={setIsViewOnceMode}
        customTimer={customTimer}
        setCustomTimer={setCustomTimer}
        showTimerMenu={showTimerMenu}
        setShowTimerMenu={setShowTimerMenu}
        isUploadingImage={isUploadingImage}
        settings={settings}
        imageInputRef={imageInputRef}
        attachMenuRef={attachMenuRef}
        emojis={emojis}
        onInputChange={handleInputChange}
        onInputPaste={handleInputPaste}
        onSend={handleSend}
        onSendThumbsUp={() => onSendMessage("👍")}
        onScrollToBottom={() => scrollToBottom(true)}
      />

      {/* Full-Screen Media & View-Once Viewer Modals */}
      <ChatMediaModals
        previewImage={previewImage}
        setPreviewImage={setPreviewImage}
        activeViewOnceMsg={activeViewOnceMsg}
        setActiveViewOnceMsg={setActiveViewOnceMsg}
        decryptedImages={decryptedImages}
        onBurnMessage={onBurnMessage}
      />

      {/* Context Menu Dropdown */}
      <ChatMessageContextMenu
        contextMenu={contextMenu}
        currentUser={currentUser}
        settings={settings}
        quickReactions={quickReactions}
        onClose={() => setContextMenu(null)}
        onAddReaction={onAddReaction}
        onStartEdit={(m) => {
          setEditingMessage(m);
          setInputText(m.text);
        }}
        onTogglePinMessage={onTogglePinMessage}
        onDeleteMessage={onDeleteMessage}
      />
    </div>
  );
}
