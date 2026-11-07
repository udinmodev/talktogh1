"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
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
  Pencil,
  Trash2,
  Copy,
} from "lucide-react";
import LinkPreviewCard, { extractUrls, formatMessageWithLinks } from "./LinkPreviewCard";
import { getThemeClasses, getWallpaperClass, getFontSizeClass, getBubbleRadius } from "@/lib/theme";
import { getInternalApiHeaders } from "@/lib/api-security";
import { bufferToBase64, uint8ArrayToBase64, base64ToBuffer } from "@/lib/crypto";

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
  const wallpaperClass = getWallpaperClass(settings?.chatWallpaper || "default");
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

  // Real File Upload Refs
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

  // Scroll metrics for seamless older messages prepending without screen jumping
  const prevScrollHeightRef = useRef<number>(0);
  const prevScrollTopRef = useRef<number>(0);
  const isPrependingOlderRef = useRef<boolean>(false);

  // Scroll messages container without forcing entire page/window to scroll
  const scrollToBottom = (smooth = true) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  };

  // Restore scroll position after older messages are prepended to the top
  useLayoutEffect(() => {
    if (isPrependingOlderRef.current && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const heightDiff = container.scrollHeight - prevScrollHeightRef.current;
      container.scrollTop = prevScrollTopRef.current + heightDiff;
      isPrependingOlderRef.current = false;
    }
  }, [messages]);

  // Handle scrolling near the top to fetch older messages
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

  // Initial scroll to bottom on contact change
  useEffect(() => {
    scrollToBottom(false);
  }, [contactUser?.id]);

  // Auto scroll to bottom when new messages arrive or peer typing state updates (unless user is reading history or prepending)
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

  // Detect if a string is a native Google Keyboard / Tenor / Giphy GIF URL
  const isGifUrl = (text: string): boolean => {
    if (!text || typeof text !== "string") return false;
    const trimmed = text.trim();
    if (!/^https?:\/\//i.test(trimmed)) return false;
    if (/\s/.test(trimmed)) return false;

    // Direct .gif or animated .webp
    if (/\.(gif|webp)(\?.*)?$/i.test(trimmed)) return true;

    // Tenor (Google Keyboard Gboard native GIF provider)
    if (/(media|c|t)\.tenor\.com\//i.test(trimmed)) return true;
    if (/tenor\.com\/view\//i.test(trimmed)) return true;

    // Giphy (Native mobile keyboards)
    if (/(media[0-9]*|i)\.giphy\.com\//i.test(trimmed)) return true;
    if (/giphy\.com\/gifs\//i.test(trimmed)) return true;

    return false;
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    // Instant offline error check
    if (!isOnline || (typeof navigator !== "undefined" && !navigator.onLine)) {
      setInlineError("Internet connection cut down! You are offline. Message cannot be sent.");
      return;
    }

    const trimmed = inputText.trim();

    if (editingMessage) {
      onEditMessage?.(editingMessage.id, trimmed);
      setEditingMessage(null);
      setInputText("");
      onTyping(false);
      return;
    }

    // Google Keyboard GIF support: detect Gboard Tenor/Giphy GIF URLs and send directly without server upload
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

  // Helper to process, optimize photos, and preserve native animated GIFs
  const processImageOrGifFile = async (
    file: File
  ): Promise<{ dataUrl: string; name: string }> => {
    const isGif = file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");

    // 1. For Native Animated GIFs: DO NOT compress via canvas (which flattens frames to a single static image)
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

    // 2. For Photos (JPEG, PNG, WebP):
    // Small photos (< 350KB) can be read directly
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

    // 3. For large photos (including 5MB-15MB camera photos from smartphones):
    // Automatically scale down to 1280px HD with smooth JPEG compression (~150KB-250KB)
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

  // Unified image/GIF sender (used by file picker, native mobile keyboard GIF paste, and drag/drop)
  const sendImageOrGifFile = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.name.toLowerCase().endsWith(".gif")) {
      setInlineError("Please select a valid image or GIF file.");
      return;
    }

    // Instant offline check
    if (!isOnline || (typeof navigator !== "undefined" && !navigator.onLine)) {
      setInlineError("Internet connection cut down! Cannot upload photo while offline.");
      return;
    }

    setIsUploadingImage(true);
    setInlineError(null);
    setShowAttachMenu(false);

    try {
      const { dataUrl, name } = await processImageOrGifFile(file);
      const currentViewOnce = isViewOnceMode;
      const currentTimerVal = customTimer;

      setIsViewOnceMode(false);
      setCustomTimer(null);

      // Instant Dispatch: Send encrypted image/GIF directly
      onSendMessage(name, "image", dataUrl, currentViewOnce, currentTimerVal);
    } catch (err: any) {
      console.warn("Image/GIF upload error:", err);
      setInlineError(err.message || "Failed to upload image or GIF.");
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
      await sendImageOrGifFile(file);
    }
    e.target.value = "";
  };

  // Mobile Keyboard Native GIF & Clipboard Paste Handler (Google Keyboard Gboard, iOS keyboard, clipboard)
  const handleInputPaste = async (e: React.ClipboardEvent) => {
    // 1. Check for native Gboard/mobile image/GIF file items
    const items = e.clipboardData?.items;
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            await sendImageOrGifFile(file);
            return;
          }
        }
      }
    }

    // 2. Check for Gboard Tenor/Giphy GIF URL or direct animated GIF link insertion
    const textData = e.clipboardData?.getData("text/plain")?.trim();
    if (textData && isGifUrl(textData)) {
      e.preventDefault();
      onSendMessage("GIF", "image", textData, isViewOnceMode, customTimer);
      setInputText("");
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

      {/* Header - Facebook Messenger Clean Header */}
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
        {isLoading && messages.length === 0 ? (
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
              You&apos;re connected on TalkTogether. Direct end-to-end encrypted conversation secured with AES-256-GCM wire cryptography.
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
                          onClick={() => {
                            setEditingMessage(msg);
                            setInputText(msg.text);
                          }}
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

              {/* Natural Messenger Bubble */}
              <div
                onContextMenu={(e) => handleMessageContextMenu(e, msg)}
                onTouchStart={(e) => handleTouchStart(e, msg)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
                className={`relative max-w-[85%] md:max-w-[70%] ${fontSizeClass} leading-relaxed transition-all ${bubbleRadius} px-3.5 py-2 cursor-pointer ${
                  isMe
                    ? `${theme.bubbleOutgoing}`
                    : "bg-[#f0f2f5] text-[#050505]"
                }`}
              >
                {/* Media Preview - Openable Full Lightbox */}
                {(msg.mediaType === "image" || (!msg.mediaUrl && isGifUrl(msg.text))) && !msg.viewOnce && (
                  <div className="mb-2">
                    {(() => {
                      const src = decryptedImages[msg.id] || msg.mediaUrl || (isGifUrl(msg.text) ? msg.text : "");
                      if (src) {
                        return (
                          <div
                            onClick={() => {
                              setPreviewImage({
                                url: src,
                                name: msg.text === "GIF" ? "Animated GIF" : (msg.text || "Photo Attachment"),
                              });
                            }}
                            className="group/img relative rounded-2xl overflow-hidden cursor-pointer shadow-xs border border-black/5 hover:opacity-95 transition-all bg-black/5"
                            title="Click to view full photo / GIF"
                          >
                            <img
                              src={src}
                              alt={msg.text || "Photo attachment"}
                              className="w-full max-h-72 object-contain rounded-2xl transition-transform duration-200 group-hover/img:scale-[1.01]"
                            />
                            {/* Hover Overlay Hint */}
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
                      onClick={() => setActiveViewOnceMsg(msg)}
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
                    {/* Message Text with interactive links (hidden if message is a native standalone GIF) */}
                    {msg.text && msg.text !== "GIF" && msg.text !== msg.mediaUrl && !isGifUrl(msg.text) && (
                      <div className="break-words">
                        {formatMessageWithLinks(msg.text, isMe)}
                      </div>
                    )}

                    {/* Rich Link Metadata Previews (skip if message is already rendered as GIF) */}
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

      {/* Hidden Real File Input for Image Upload (Photos & Native GIFs) */}
      <input
        type="file"
        ref={imageInputRef}
        onChange={handleImageFileChange}
        accept="image/*,image/gif"
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
            <div>
              <span className="block font-medium">Photo & GIF</span>
              <span className="block text-[10px] text-[#65676b]">Up to 4MB</span>
            </div>
          </button>
        </div>
      )}

      {/* Facebook Messenger Clean Input Bar */}
      <footer className="sticky bottom-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white border-t border-[#f0f2f5] z-30 shrink-0">
        <div className="max-w-4xl mx-auto">
          {/* Editing Message Banner */}
          {editingMessage && (
            <div className="mb-2 px-3.5 py-2 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-[#0084ff] animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center gap-2 min-w-0">
                <Pencil className="h-4 w-4 text-[#0084ff] shrink-0" />
                <div className="min-w-0">
                  <span className="font-semibold text-[#050505]">Editing message:</span>
                  <p className="truncate text-neutral-600 text-[11px] max-w-[240px] sm:max-w-md">
                    {editingMessage.text}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingMessage(null);
                  setInputText("");
                }}
                className="p-1 rounded-full hover:bg-blue-100 text-neutral-500 hover:text-neutral-800 cursor-pointer shrink-0"
                title="Cancel editing"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

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
              <form onSubmit={handleSend} onPaste={handleInputPaste} className="flex-1 flex items-center mr-1">
                <input
                  type="text"
                  value={inputText}
                  onChange={handleInputChange}
                  onPaste={handleInputPaste}
                  enterKeyHint="send"
                  autoComplete="off"
                  onFocus={() => {
                    setTimeout(() => scrollToBottom(true), 150);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      if (settings?.enterToSend === false) {
                        e.preventDefault();
                      }
                    }
                  }}
                  placeholder="Aa"
                  className="w-full bg-transparent text-[#050505] placeholder:text-[#65676b] text-base sm:text-sm focus:outline-none"
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
                className={`w-9 h-9 rounded-full ${
                  editingMessage
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-[#0084ff] hover:bg-[#0073e6]"
                } text-white flex items-center justify-center font-bold shadow-xs transition-transform active:scale-95 cursor-pointer shrink-0`}
                title={editingMessage ? "Save edit" : "Send message"}
              >
                {editingMessage ? (
                  <Check className="h-4 w-4 text-white stroke-[2.5]" />
                ) : (
                  <Send className="h-4 w-4 fill-current ml-0.5" />
                )}
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

      {/* Full-Screen Secure View-Once Viewer Modal */}
      {activeViewOnceMsg && (
        <div
          className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-md flex flex-col animate-in fade-in duration-150 select-none"
          onClick={() => {
            const id = activeViewOnceMsg.id;
            setActiveViewOnceMsg(null);
            onBurnMessage?.(id);
          }}
        >
          {/* Top Bar with Security Badge & Close Button */}
          <div
            className="h-16 px-4 md:px-6 flex items-center justify-between text-white bg-black/70 border-b border-white/10 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 ring-1 ring-amber-400/40">
                <Flame className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate text-white flex items-center gap-2">
                  <span>Confidential View-Once</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">
                    Self-Destruct
                  </span>
                </p>
                <p className="text-[11px] text-neutral-400">
                  This message will permanently destroy when closed
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                const id = activeViewOnceMsg.id;
                setActiveViewOnceMsg(null);
                onBurnMessage?.(id);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-white/15"
              title="Close and destroy message"
            >
              <X className="h-4 w-4" />
              <span>Close & Destroy</span>
            </button>
          </div>

          {/* Modal Content Stage */}
          <div
            className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {activeViewOnceMsg.mediaType === "image" ? (
              <div className="flex flex-col items-center max-w-4xl max-h-[80vh]">
                <img
                  src={decryptedImages[activeViewOnceMsg.id] || activeViewOnceMsg.mediaUrl}
                  alt={activeViewOnceMsg.text || "View-once image"}
                  className="max-h-[75vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl border border-white/10"
                />
                {activeViewOnceMsg.text && (
                  <p className="mt-4 text-sm text-neutral-200 bg-neutral-900/90 border border-neutral-700 px-4 py-2 rounded-xl max-w-lg text-center">
                    {activeViewOnceMsg.text}
                  </p>
                )}
                <button
                  onClick={() => {
                    const id = activeViewOnceMsg.id;
                    setActiveViewOnceMsg(null);
                    onBurnMessage?.(id);
                  }}
                  className="mt-6 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs tracking-wide shadow-lg transition-all cursor-pointer active:scale-95"
                >
                  Done (Destroy Photo)
                </button>
              </div>
            ) : (
              <div className="bg-neutral-900/95 border border-neutral-800 rounded-3xl p-6 md:p-8 max-w-lg w-full text-white shadow-2xl space-y-4">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider">
                  <Lock className="h-4 w-4" />
                  <span>Confidential Content</span>
                </div>
                <div className="text-base md:text-lg leading-relaxed break-words font-medium text-neutral-100 min-h-[60px]">
                  {formatMessageWithLinks(activeViewOnceMsg.text, false)}
                </div>
                {(() => {
                  const urls = extractUrls(activeViewOnceMsg.text);
                  if (urls.length === 0) return null;
                  return (
                    <div className="space-y-2 pt-2 border-t border-neutral-800">
                      {urls.map((u, i) => (
                        <LinkPreviewCard
                          key={i}
                          url={u}
                          initialMetadata={activeViewOnceMsg.linkMetadata?.find((m) => m.url === u)}
                          isMe={false}
                        />
                      ))}
                    </div>
                  );
                })()}
                <div className="pt-3">
                  <button
                    onClick={() => {
                      const id = activeViewOnceMsg.id;
                      setActiveViewOnceMsg(null);
                      onBurnMessage?.(id);
                    }}
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs tracking-wide shadow-lg transition-all cursor-pointer active:scale-95"
                  >
                    Done (Destroy Message)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Context Menu Dropdown on Right Click or Long Press */}
      {contextMenu && (
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
                  onAddReaction(contextMenu.message.id, emoji);
                  setContextMenu(null);
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
            {contextMenu.message.senderId === currentUser.id && !contextMenu.message.viewOnce && (
              <button
                type="button"
                onClick={() => {
                  setEditingMessage(contextMenu.message);
                  setInputText(contextMenu.message.text);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#f0f2f5] text-neutral-800 font-medium cursor-pointer transition-colors text-left"
              >
                <Pencil className="h-4 w-4 text-[#0084ff]" />
                <span>Edit message</span>
              </button>
            )}

            {/* Copy Text */}
            {!settings.preventCopyForward && contextMenu.message.text && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.message.text);
                  setContextMenu(null);
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
                  onTogglePinMessage(contextMenu.message.id);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#f0f2f5] text-neutral-800 font-medium cursor-pointer transition-colors text-left"
              >
                <Pin
                  className={`h-4 w-4 ${
                    contextMenu.message.isPinned ? "fill-current text-amber-500" : "text-neutral-500"
                  }`}
                />
                <span>{contextMenu.message.isPinned ? "Unpin message" : "Pin message"}</span>
              </button>
            )}

            {/* Delete (if sender's message) */}
            {contextMenu.message.senderId === currentUser.id && (
              <>
                <div className="h-[1px] bg-neutral-100 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    const msgId = contextMenu.message.id;
                    setContextMenu(null);
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
      )}
    </div>
  );
}
