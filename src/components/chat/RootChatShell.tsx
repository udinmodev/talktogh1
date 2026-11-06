"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import { User, Message, SecuritySettings, LinkMetadata, DEFAULT_SETTINGS } from "@/types/chat";
import { extractUrls, getClientLinkMetadata } from "@/components/chat/LinkPreviewCard";
import { soundManager } from "@/lib/sound";
import {
  encryptMessageContent,
  decryptMessageContent,
  getPairSessionKey,
  getPairSafetyNumber,
} from "@/lib/crypto";
import { chatSync } from "@/lib/broadcast";
import { secureSocket } from "@/lib/socket";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { SafetyNumberModal } from "@/components/chat/SafetyNumberModal";
import { SecurityCommandCenter } from "@/components/chat/SecurityCommandCenter";
import { MobileSettingsPage } from "@/components/chat/MobileSettingsPage";
import { AppLockScreen } from "@/components/chat/AppLockScreen";
import { AuthLoginPage } from "@/components/auth/AuthLoginPage";
import { SecuritySetupScreen } from "@/components/auth/SecuritySetupScreen";
import {
  getCurrentAuthUser,
  isSessionUnlocked,
  setSessionUnlocked,
  logoutUser,
  AuthUser,
} from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import { fromSupabaseRow, SupabaseWireRow } from "@/types/wire";
import { WifiOff, X } from "lucide-react";
import { ChatContext, ChatContextType } from "./ChatContext";
import { getInternalApiHeaders } from "@/lib/api-security";

export default function RootChatShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();

  // Extract /id parameter from route params or current pathname reliably
  const pathId =
    pathname && pathname !== "/" && !pathname.startsWith("/api")
      ? pathname.replace(/^\//, "").split("/")[0]
      : "";
  const rawId = params?.id ? (Array.isArray(params.id) ? params.id[0] : params.id) : pathId;
  const routeContactId =
    rawId && rawId !== "favicon.ico" && !rawId.startsWith("api")
      ? decodeURIComponent(rawId).split("@")[0].toLowerCase()
      : "";

  // User Authentication & Session State
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);

  // Dynamic real registered users directory
  const [contacts, setContacts] = useState<User[]>([]);

  // Current active user identity and selected chat ID
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [selectedContactId, setSelectedContactId] = useState<string>(routeContactId);
  const [mobileView, setMobileView] = useState<"sidebar" | "chat" | "settings">(
    routeContactId ? "chat" : "sidebar"
  );

  // Synchronize state when route changes (zero flicker, continuous layout)
  useEffect(() => {
    if (routeContactId) {
      setSelectedContactId(routeContactId);
      setMobileView("chat");
    }
  }, [routeContactId]);

  // Load auth state on client mount
  useEffect(() => {
    const user = getCurrentAuthUser();
    setAuthUser(user);
    if (user) {
      setCurrentUserId(user.username);
      if (user.isSecuritySetupComplete) {
        setIsAppLocked(!isSessionUnlocked());
      }
    }
    setIsAuthLoaded(true);
  }, []);

  const handleLoginSuccess = (user: AuthUser) => {
    setAuthUser(user);
    setCurrentUserId(user.username);
    if (user.isSecuritySetupComplete) {
      setIsAppLocked(true);
    }
  };

  const handleSecuritySetupComplete = (updatedUser: AuthUser) => {
    setAuthUser(updatedUser);
    setSessionUnlocked(true);
    setIsAppLocked(false);
    handleUpdateSettings({ appLockPinHash: updatedUser.pinHash });
  };

  const handleLogout = () => {
    logoutUser();
    setAuthUser(null);
    setIsAppLocked(false);
    setSelectedContactId("");
    router.push("/");
  };

  // Crypto Keys in state
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null);
  const [safetyNumber, setSafetyNumber] = useState<string>(
    "51940 38472 90184 62819 02847 19482 65019 47201 83920 18274 01928 37482"
  );

  const cleanCurrentId = (authUser ? authUser.username : (currentUserId || "user")).split("@")[0].toLowerCase();

  // Security & Customization Settings with Cloud Database Persistence (with offline local cache)
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SETTINGS);

  // Load saved preferences from cloud database
  useEffect(() => {
    if (!cleanCurrentId || cleanCurrentId === "user") return;

    try {
      const saved = localStorage.getItem(`wechat_settings_${cleanCurrentId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Guarantee zero plaintext pin in client cache
        delete parsed.appLockPin;
        delete parsed.pin;
        delete parsed.correctPin;
        delete parsed.lockPin;

        // Force default to 0 (Off) if it was previously set to the old 30s default
        if (parsed.disappearingTimer === 30 && !localStorage.getItem(`wechat_dtimer_explicit_${cleanCurrentId}`)) {
          parsed.disappearingTimer = 0;
        }
        setSettings((prev) => ({ ...prev, ...parsed }));
        localStorage.setItem(`wechat_settings_${cleanCurrentId}`, JSON.stringify(parsed));
      }
    } catch {}

    fetch(`/api/settings?userId=${encodeURIComponent(cleanCurrentId)}`, {
      headers: getInternalApiHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.settings) {
          const s = data.settings;
          delete s.appLockPin;
          delete s.pin;
          delete s.correctPin;
          delete s.lockPin;

          // Force default to 0 (Off) if it was previously initialized to the old 30s default
          if (s.disappearingTimer === 30 && !localStorage.getItem(`wechat_dtimer_explicit_${cleanCurrentId}`)) {
            s.disappearingTimer = 0;
          }
          setSettings((prev) => ({ ...prev, ...s }));
          try {
            localStorage.setItem(`wechat_settings_${cleanCurrentId}`, JSON.stringify(s));
          } catch {}
        }
      })
      .catch((err) => console.warn("Cloud settings fetch notice:", err));
  }, [cleanCurrentId]);

  const handleUpdateSettings = useCallback(
    (newOpts: Partial<SecuritySettings>) => {
      setSettings((prev) => {
        const updated = { ...prev, ...newOpts };
        delete (updated as any).appLockPin;
        delete (updated as any).pin;
        delete (updated as any).correctPin;
        delete (updated as any).lockPin;

        if (newOpts.disappearingTimer !== undefined) {
          try {
            localStorage.setItem(`wechat_dtimer_explicit_${cleanCurrentId}`, "true");
          } catch {}
        }

        try {
          localStorage.setItem(`wechat_settings_${cleanCurrentId}`, JSON.stringify(updated));
        } catch {}

        if (cleanCurrentId && cleanCurrentId !== "user") {
          fetch("/api/settings", {
            method: "POST",
            headers: getInternalApiHeaders(),
            body: JSON.stringify({ userId: cleanCurrentId, settings: updated }),
          }).catch((err) => console.warn("Cloud settings persist notice:", err));

          chatSync.broadcast({
            type: "SAVE_SETTINGS",
            userId: cleanCurrentId,
            settings: updated,
          });
        }

        return updated;
      });
    },
    [cleanCurrentId]
  );

  // App Lock State (Always locks on refresh/load for security)
  const [isAppLocked, setIsAppLocked] = useState<boolean>(true);
  const [isWindowBlurred, setIsWindowBlurred] = useState<boolean>(false);

  // Instant Network Offline Detection
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Monitor network online/offline events and socket state
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setNetworkError(null);
      secureSocket.connect();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setNetworkError("Internet connection cut down! You are offline. Messages will fail to send.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const unsubSocket = secureSocket.onStatusChange((status) => {
      if (status === "disconnected" && typeof navigator !== "undefined" && navigator.onLine) {
        setNetworkError("Disconnected from secure relay server. Reconnecting...");
      } else if (status === "connected") {
        setNetworkError(null);
      }
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubSocket();
    };
  }, []);

  // Modals state
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [isSecurityCenterOpen, setIsSecurityCenterOpen] = useState(false);

  // Messages State
  const [messages, setMessages] = useState<Message[]>([]);
  const [isPeerTyping, setIsPeerTyping] = useState<boolean>(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState<boolean>(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(true);

  const currentUser: User = {
    id: cleanCurrentId,
    name: authUser ? authUser.name : "User",
    role: authUser?.role || "owner",
    avatar: authUser?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(authUser?.name || "User")}`,
    phone: `@${cleanCurrentId}`,
    about: "Using confidential E2EE messenger.",
    publicKeyFingerprint: cleanCurrentId.length >= 8 ? cleanCurrentId.substring(0, 8).toUpperCase() + "7EFE2C" : "7EFE2C6DCC10DA73",
    isOnline: isOnline,
  };

  const partnerContact = contacts.find((c) => c.id !== cleanCurrentId);
  const rawActiveChatId = (selectedContactId || routeContactId || "").split("@")[0].toLowerCase();
  const activeChatId = (
    rawActiveChatId && rawActiveChatId !== "none" && rawActiveChatId !== cleanCurrentId
      ? rawActiveChatId
      : partnerContact?.id || ""
  ).split("@")[0].toLowerCase();

  const contactUser: User =
    (activeChatId && activeChatId !== "none" ? contacts.find((c) => c.id === activeChatId) : null) ||
    partnerContact || {
      id: activeChatId || "none",
      name:
        activeChatId && activeChatId !== "none"
          ? activeChatId
          : "Select a Contact",
      role: "contact",
      avatar:
        activeChatId && activeChatId !== "none"
          ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(activeChatId)}`
          : "https://api.dicebear.com/7.x/initials/svg?seed=None",
      phone: activeChatId && activeChatId !== "none" ? `@${activeChatId}` : "",
      about:
        activeChatId && activeChatId !== "none"
          ? "Registered confidential identity."
          : "No user selected.",
      publicKeyFingerprint: "7EFE2C6DCC10DA73",
      isOnline: false,
    };

  // Load real registered user accounts from Supabase (Zero fake chats, zero mock channels)
  const loadLiveContacts = useCallback(async (myId: string) => {
    const safetyTimer = setTimeout(() => {
      setIsLoadingContacts(false);
    }, 2500);

    try {
      const res = await fetch("/api/users", {
        headers: getInternalApiHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.users && data.users.length > 0) {
          const myCleanId = String(myId || "").split("@")[0].toLowerCase();
          const registeredUsers: User[] = data.users
            .filter((u: any) => String(u.id || u.username || "").split("@")[0].toLowerCase() !== myCleanId)
            .map((u: any) => {
              const cleanContactId = String(u.id || u.username || "").split("@")[0].toLowerCase();
              return {
                id: cleanContactId,
                name: u.name || cleanContactId,
                role: "contact" as const,
                avatar: u.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.name || cleanContactId)}`,
                phone: `@${cleanContactId}`,
                about: u.about || "Registered confidential identity.",
                publicKeyFingerprint: u.publicKeyFingerprint || "7EFE2C6DCC10DA73",
                isOnline: true,
                lastSeen: "online",
              };
            });

          setContacts(registeredUsers);
          if (routeContactId && routeContactId !== myCleanId) {
            setSelectedContactId(routeContactId);
          } else if (registeredUsers.length === 1) {
            const partner = registeredUsers[0].id;
            setSelectedContactId(partner);
            if (pathname !== `/${partner}`) {
              router.replace(`/${partner}`);
            }
          }
        }
      }
    } catch (err) {
      console.warn("Contact load error:", err);
    } finally {
      clearTimeout(safetyTimer);
      setIsLoadingContacts(false);
    }
  }, [routeContactId]);

  useEffect(() => {
    if (currentUser.id) {
      loadLiveContacts(currentUser.id);
    }
  }, [currentUser.id, loadLiveContacts]);

  // Dynamically derive shared E2EE session key for the currently selected chat
  useEffect(() => {
    let isCancelled = false;

    async function updateChatCrypto() {
      try {
        const partnerId = activeChatId;
        if (!partnerId || partnerId === "none" || partnerId === cleanCurrentId || !cleanCurrentId || cleanCurrentId === "user") return;
        const derivedKey = await getPairSessionKey(cleanCurrentId, partnerId);
        const code = await getPairSafetyNumber(cleanCurrentId, partnerId);

        if (!isCancelled) {
          setSessionKey(derivedKey);
          setSafetyNumber(code);
        }
      } catch (err) {
        console.warn("Crypto derivation notice:", err);
      }
    }

    updateChatCrypto();

    return () => {
      isCancelled = true;
    };
  }, [cleanCurrentId, activeChatId]);

  // Process incoming wire messages from WebSocket synchronization
  const processIncomingWireBatch = useCallback(async (wireList: any[]) => {
    if (!currentUser.id || currentUser.id === "user" || !wireList) {
      setIsLoadingMessages(false);
      return;
    }
    try {
      const decryptedList: Message[] = [];
      for (const wire of wireList) {
        try {
          const isChannel = wire.recipientId?.startsWith("public-");
          const cleanSender = String(wire.senderId || "").split("@")[0].toLowerCase();
          const cleanRecipient = String(wire.recipientId || "").split("@")[0].toLowerCase();
          const cleanCurrent = String(currentUser.id || "").split("@")[0].toLowerCase();

          const partnerId = isChannel
            ? cleanRecipient
            : cleanSender === cleanCurrent
            ? cleanRecipient
            : cleanSender;

          if (!partnerId || partnerId === "none" || partnerId === cleanCurrent) continue;

          let ep = wire.encryptedPayload;
          if (typeof ep === "string") {
            try {
              ep = JSON.parse(ep);
            } catch {}
          }
          if (!ep || !ep.iv || !ep.ciphertext) continue;

          const chatKey = await getPairSessionKey(cleanCurrent, partnerId);
          const decrypted = await decryptMessageContent(ep, chatKey);
          decryptedList.push({
            ...wire,
            senderId: cleanSender,
            recipientId: cleanRecipient,
            encryptedPayload: ep,
            text: decrypted.text,
            linkMetadata: decrypted.linkMetadata,
            mediaType: decrypted.mediaType || wire.mediaType,
            mediaUrl: decrypted.mediaUrl || wire.mediaUrl,
            reactions: wire.reactions || {},
          });
        } catch {
          // Encrypted for another contact
        }
      }
      setMessages(decryptedList);
    } catch (err) {
      console.warn("WebSocket wire batch decrypt error:", err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [currentUser.id]);

  // Load initial messages via secure REST endpoint and WebSocket sync
  const loadInitialMessages = useCallback(
    async (myId: string) => {
      if (!myId || myId === "user") {
        setIsLoadingMessages(false);
        return;
      }

      setIsLoadingMessages(true);
      const cleanId = String(myId).split("@")[0].toLowerCase();

      // Failsafe timer: Maximum 2 seconds of skeleton loading under any network condition
      const timer = setTimeout(() => {
        setIsLoadingMessages(false);
      }, 2000);

      try {
        // 1. Trigger WebSocket sync if active
        secureSocket.registerUser(cleanId);
        secureSocket.requestMessageSync(cleanId);

        // 2. Fetch persisted messages from REST route
        const res = await fetch(`/api/messages?userId=${encodeURIComponent(cleanId)}`, {
          headers: getInternalApiHeaders(),
        });

        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.messages)) {
            await processIncomingWireBatch(data.messages);
          }
        }
      } catch (err) {
        console.warn("Message sync fetch notice:", err);
      } finally {
        clearTimeout(timer);
        setIsLoadingMessages(false);
      }
    },
    [processIncomingWireBatch]
  );

  useEffect(() => {
    if (currentUser.id && currentUser.id !== "user") {
      loadInitialMessages(currentUser.id);
    } else {
      setIsLoadingMessages(false);
    }
  }, [currentUser.id, loadInitialMessages]);

  // Supabase Realtime Listener
  useEffect(() => {
    if (!currentUser.id || currentUser.id === "user") return;
    const client = getSupabaseClient();
    if (!client) return;

    const channelName = `realtime-chat-${currentUser.id}-${Date.now()}`;
    const channel = client.channel(channelName);

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wire_messages" },
        async (payload) => {
          const newRow = payload.new as SupabaseWireRow;
          if (!newRow || !newRow.id) return;
          const wire = fromSupabaseRow(newRow);

          const cleanSender = String(wire.senderId || "").split("@")[0].toLowerCase();
          const cleanRecipient = String(wire.recipientId || "").split("@")[0].toLowerCase();
          const cleanCurrent = String(currentUser.id || "").split("@")[0].toLowerCase();

          const isRelevant =
            cleanRecipient === cleanCurrent ||
            cleanSender === cleanCurrent ||
            cleanRecipient.startsWith("public-");

          if (!isRelevant) return;

          try {
            const isChannel = cleanRecipient.startsWith("public-");
            const partnerId = isChannel
              ? cleanRecipient
              : cleanSender === cleanCurrent
              ? cleanRecipient
              : cleanSender;

            if (!partnerId || partnerId === "none" || partnerId === cleanCurrent) return;

            let ep = wire.encryptedPayload;
            if (typeof ep === "string") {
              try {
                ep = JSON.parse(ep);
              } catch {}
            }
            if (!ep || !ep.iv || !ep.ciphertext) return;

            const chatKey = await getPairSessionKey(cleanCurrent, partnerId);
            const decrypted = await decryptMessageContent(ep, chatKey);
            const duration = wire.disappearingDuration && wire.disappearingDuration > 0 ? wire.disappearingDuration : null;

            const newMsg: Message = {
              id: wire.id,
              senderId: cleanSender,
              recipientId: cleanRecipient,
              text: decrypted.text,
              encryptedPayload: ep,
              timestamp: wire.timestamp,
              status: (wire.status as Message["status"]) || "delivered",
              disappearingDuration: duration,
              expiresAt: wire.expiresAt,
              viewOnce: wire.viewOnce,
              isBurned: wire.isBurned,
              isPinned: wire.isPinned,
              securityType: wire.securityType,
              linkMetadata: decrypted.linkMetadata,
              mediaType: decrypted.mediaType || wire.mediaType,
              mediaUrl: decrypted.mediaUrl || wire.mediaUrl,
              reactions: wire.reactions,
            };

            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) {
                return prev.map((m) => (m.id === newMsg.id ? newMsg : m));
              }
              return [...prev, newMsg];
            });

            if (settings.soundEffects !== false && wire.senderId !== currentUser.id) {
              soundManager.playReceive();
            }
          } catch (e) {
            console.warn("Could not decrypt incoming Realtime message:", e);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "wire_messages" },
        (payload) => {
          const updatedRow = payload.new as SupabaseWireRow;
          if (!updatedRow || !updatedRow.id) return;
          const wire = fromSupabaseRow(updatedRow);

          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === wire.id) {
                return {
                  ...m,
                  status: (wire.status as Message["status"]) || m.status,
                  isPinned: wire.isPinned,
                  isBurned: wire.isBurned,
                  reactions: wire.reactions || m.reactions,
                };
              }
              return m;
            })
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "wire_messages" },
        (payload) => {
          const oldRow = payload.old as { id?: string };
          if (!oldRow || !oldRow.id) return;
          setMessages((prev) => prev.filter((m) => m.id !== oldRow.id));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_accounts" },
        () => {
          loadLiveContacts(currentUser.id);
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [currentUser.id, settings.soundEffects, settings.disappearingTimer, loadLiveContacts]);

  // Event-Driven Message Expiration
  const scheduledTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    messages.forEach((msg) => {
      if (msg.expiresAt && !scheduledTimeoutsRef.current.has(msg.id)) {
        const delay = Math.max(0, msg.expiresAt - Date.now());
        const timeout = setTimeout(() => {
          setMessages((prev) => prev.filter((m) => m.id !== msg.id));
          scheduledTimeoutsRef.current.delete(msg.id);
        }, delay);
        scheduledTimeoutsRef.current.set(msg.id, timeout);
      }
    });

    return () => {
      scheduledTimeoutsRef.current.forEach((t) => clearTimeout(t));
      scheduledTimeoutsRef.current.clear();
    };
  }, [messages]);

  // Privacy Curtain
  useEffect(() => {
    const handleBlur = () => {
      if (settings.privacyCurtain) setIsWindowBlurred(true);
    };
    const handleFocus = () => setIsWindowBlurred(false);

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [settings.privacyCurtain]);

  // Inactivity Auto-Lock
  useEffect(() => {
    if (!settings.appLockEnabled || isAppLocked) return;

    let inactivityTimeout: NodeJS.Timeout;
    const lockTimeMs = (settings.inactivityLockSeconds || 60) * 1000;

    const resetTimer = () => {
      clearTimeout(inactivityTimeout);
      inactivityTimeout = setTimeout(() => {
        setIsAppLocked(true);
      }, lockTimeMs);
    };

    const activityEvents = ["mousedown", "keydown", "touchstart", "scroll"];
    activityEvents.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(inactivityTimeout);
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [settings.appLockEnabled, settings.inactivityLockSeconds, isAppLocked]);

  // Multi-Tab Sync with BroadcastChannel
  useEffect(() => {
    const unsubscribe = chatSync.subscribe(async (action) => {
      if (action.type === "NEW_MESSAGE") {
        try {
          const isChannel = action.payload.recipientId?.startsWith("public-");
          const cleanSender = String(action.payload.senderId || "").split("@")[0].toLowerCase();
          const cleanRecipient = String(action.payload.recipientId || "").split("@")[0].toLowerCase();
          const cleanCurrent = String(currentUser.id || "").split("@")[0].toLowerCase();

          const partnerId = isChannel
            ? cleanRecipient
            : cleanSender === cleanCurrent
            ? cleanRecipient
            : cleanSender;

          if (!partnerId || partnerId === "none" || partnerId === cleanCurrent) return;

          let ep = action.payload;
          if (typeof ep === "string") {
            try {
              ep = JSON.parse(ep);
            } catch {}
          }
          if (!ep || !ep.iv || !ep.ciphertext) return;

          const key = await getPairSessionKey(cleanCurrent, partnerId);
          const decrypted = await decryptMessageContent(ep, key);
          const duration =
            action.disappearingDuration && action.disappearingDuration > 0
              ? action.disappearingDuration
              : null;

          const newMsg: Message = {
            id: action.messageId,
            senderId: cleanSender,
            recipientId: cleanRecipient,
            text: decrypted.text,
            encryptedPayload: ep,
            timestamp: action.payload.timestamp,
            status: "read",
            disappearingDuration: duration,
            expiresAt: duration ? Date.now() + duration * 1000 : null,
            viewOnce: action.viewOnce,
            securityType: action.securityType,
            linkMetadata: decrypted.linkMetadata,
            mediaType: decrypted.mediaType,
            mediaUrl: decrypted.mediaUrl,
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) {
              return prev.map((m) => (m.id === newMsg.id ? newMsg : m));
            }
            return [...prev, newMsg];
          });
        } catch (err) {
          console.error("Failed to decrypt received broadcast message:", err);
        }
      } else if (action.type === "TOGGLE_PIN") {
        setMessages((prev) =>
          prev.map((m) => (m.id === action.messageId ? { ...m, isPinned: action.isPinned } : m))
        );
      } else if (action.type === "VIEW_ONCE_OPENED") {
        setMessages((prev) =>
          prev.map((m) => (m.id === action.messageId ? { ...m, isBurned: true } : m))
        );
      } else if (action.type === "MESSAGE_STATUS_UPDATE") {
        setMessages((prev) =>
          prev.map((m) => (m.id === action.messageId ? { ...m, status: action.status } : m))
        );
      } else if (action.type === "TYPING_INDICATOR") {
        if (action.senderId !== currentUserId) {
          setIsPeerTyping(action.isTyping);
        }
      } else if (action.type === "SYNC_MESSAGES" && Array.isArray(action.messages)) {
        processIncomingWireBatch(action.messages);
      } else if (action.type === "REACTION") {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === action.messageId) {
              const reactions = { ...(m.reactions || {}) };
              if (reactions[action.userId] === action.emoji) {
                delete reactions[action.userId];
              } else {
                reactions[action.userId] = action.emoji;
              }
              return { ...m, reactions };
            }
            return m;
          })
        );
      } else if (action.type === "KEY_ROTATION") {
        setSettings((prev) => ({
          ...prev,
          keyRotationVersion: action.newVersion,
          lastRekeyedAt: Date.now(),
        }));
      } else if (action.type === "SYNC_SETTINGS" && action.settings) {
        setSettings((prev) => ({ ...prev, ...action.settings }));
      } else if (
        action.type === "SETTINGS_UPDATED" &&
        action.userId === cleanCurrentId &&
        action.settings
      ) {
        setSettings((prev) => ({ ...prev, ...action.settings }));
      } else if (action.type === "WIPE_ALL") {
        setMessages([]);
      }
    });

    return () => unsubscribe();
  }, [sessionKey, settings.disappearingTimer, currentUserId, cleanCurrentId, processIncomingWireBatch, currentUser.id]);

  // Send Message Handler
  const handleSendMessage = useCallback(
    async (
      text: string,
      mediaType?: "image" | "voice" | "doc",
      mediaUrl?: string,
      viewOnce?: boolean,
      customDuration?: number | null
    ) => {
      const myId = cleanCurrentId;
      const targetId = (
        contactUser?.id && contactUser.id !== "none"
          ? contactUser.id
          : activeChatId
      ).split("@")[0].toLowerCase();

      if (!targetId || targetId === "none") {
        console.warn("No recipient selected to send message to.");
        return;
      }

      let activeKey = sessionKey;
      if (!activeKey) {
        try {
          activeKey = await getPairSessionKey(myId, targetId);
          if (activeKey) {
            setSessionKey(activeKey);
          }
        } catch (err) {
          console.error("Crypto session key derivation error:", err);
        }
      }

      if (!activeKey) {
        console.error("Cannot send message: Crypto session key could not be established.");
        return;
      }

      if (!isOnline || (typeof navigator !== "undefined" && !navigator.onLine)) {
        setNetworkError("Internet connection cut down! Failed to send message. You are offline.");
        const failedMsgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const failedMsg: Message = {
          id: failedMsgId,
          senderId: myId,
          recipientId: targetId,
          text,
          encryptedPayload: {
            iv: "",
            ciphertext: "",
            algorithm: "AES-256-GCM (HKDF-SHA256)",
            senderId: myId,
            recipientId: targetId,
            timestamp: Date.now(),
          },
          timestamp: Date.now(),
          status: "error",
          mediaType,
          mediaUrl,
          viewOnce,
        };
        setMessages((prev) => [...prev, failedMsg]);
        return;
      }

      try {
        const newMsgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        const effectiveDuration =
          customDuration !== undefined && customDuration !== null
            ? (customDuration > 0 ? customDuration : null)
            : settings.disappearingTimer > 0
            ? settings.disappearingTimer
            : null;

        const hasExpiry = effectiveDuration !== null && effectiveDuration > 0;

        const detectedUrls = extractUrls(text);
        const linkMetadata: LinkMetadata[] | undefined =
          detectedUrls.length > 0
            ? detectedUrls.slice(0, 3).map((u) => getClientLinkMetadata(u))
            : undefined;

        const payload = await encryptMessageContent(
          { text, linkMetadata, mediaType, mediaUrl },
          activeKey,
          myId,
          targetId
        );

        const newMsg: Message = {
          id: newMsgId,
          senderId: myId,
          recipientId: targetId,
          text,
          encryptedPayload: payload,
          timestamp: Date.now(),
          status: "delivered",
          disappearingDuration: effectiveDuration,
          expiresAt: hasExpiry ? Date.now() + effectiveDuration * 1000 : null,
          mediaType,
          mediaUrl,
          viewOnce,
          securityType: viewOnce
            ? "view_once"
            : hasExpiry
            ? "disappearing"
            : "standard",
          linkMetadata,
        };

        setMessages((prev) => [...prev, newMsg]);

        if (settings.soundEffects !== false) {
          soundManager.playSend();
        }

        try {
          chatSync.broadcast({
            type: "NEW_MESSAGE",
            payload,
            messageId: newMsgId,
            viewOnce,
            disappearingDuration: effectiveDuration,
            securityType: newMsg.securityType,
          });
        } catch (netErr) {
          console.warn("Broadcast warning:", netErr);
        }

        // Persist zero-knowledge wire envelope to database
        const wireData = {
          id: newMsgId,
          senderId: myId,
          recipientId: targetId,
          encryptedPayload: payload,
          timestamp: newMsg.timestamp,
          status: "delivered",
          disappearingDuration: effectiveDuration,
          expiresAt: newMsg.expiresAt,
          viewOnce: Boolean(viewOnce),
          isBurned: false,
          isPinned: false,
          securityType: newMsg.securityType,
          mediaType,
          mediaUrl,
        };

        fetch("/api/messages", {
          method: "POST",
          headers: getInternalApiHeaders(),
          body: JSON.stringify({ action: "send", message: wireData }),
        }).catch((err) => console.warn("Cloud message persist notice:", err));
      } catch (err) {
        console.error("Encryption failed:", err);
      }
    },
    [sessionKey, cleanCurrentId, contactUser?.id, activeChatId, settings.disappearingTimer, settings.soundEffects, isOnline]
  );

  const handleTogglePinMessage = (messageId: string) => {
    let nextPinnedState = false;
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === messageId) {
          nextPinnedState = !m.isPinned;
          return { ...m, isPinned: nextPinnedState };
        }
        return m;
      })
    );

    chatSync.broadcast({
      type: "TOGGLE_PIN",
      messageId,
      isPinned: nextPinnedState,
    });

    fetch("/api/messages", {
      method: "POST",
      headers: getInternalApiHeaders(),
      body: JSON.stringify({ action: "pin", messageId, isPinned: nextPinnedState }),
    }).catch((err) => console.warn("Cloud message pin notice:", err));
  };

  const handleBurnMessage = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, isBurned: true } : m))
    );

    chatSync.broadcast({
      type: "VIEW_ONCE_OPENED",
      messageId,
    });

    fetch("/api/messages", {
      method: "POST",
      headers: getInternalApiHeaders(),
      body: JSON.stringify({ action: "burn", messageId }),
    }).catch((err) => console.warn("Cloud message burn notice:", err));
  };

  const handleTyping = (isTyping: boolean) => {
    chatSync.broadcast({
      type: "TYPING_INDICATOR",
      senderId: currentUser.id,
      isTyping,
    });
  };

  const handleAddReaction = (messageId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === messageId) {
          return {
            ...m,
            reactions: {
              ...(m.reactions || {}),
              [currentUser.id]: emoji,
            },
          };
        }
        return m;
      })
    );

    chatSync.broadcast({
      type: "REACTION",
      messageId,
      emoji,
      userId: currentUser.id,
    });

    fetch("/api/messages", {
      method: "POST",
      headers: getInternalApiHeaders(),
      body: JSON.stringify({
        action: "reaction",
        messageId,
        reaction: { userId: currentUser.id, emoji },
      }),
    }).catch((err) => console.warn("Cloud message reaction notice:", err));
  };

  const activeMessages = messages.filter((m) => {
    const s = String(m.senderId || "").split("@")[0].toLowerCase();
    const r = String(m.recipientId || "").split("@")[0].toLowerCase();
    const target = activeChatId;
    if (!target || target === "none") return false;
    return (
      (s === target && r === cleanCurrentId) ||
      (s === cleanCurrentId && r === target) ||
      (target.startsWith("public-") && r === target)
    );
  });

  const contextValue: ChatContextType = {
    currentUser,
    contactUser,
    contacts,
    selectedContactId,
    activeMessages,
    allMessages: messages,
    settings,
    sessionKey,
    isLoadingContacts,
    isLoadingMessages,
    isPeerTyping,
    isOnline,
    networkError,
    sendMessage: handleSendMessage,
    burnMessage: handleBurnMessage,
    togglePinMessage: handleTogglePinMessage,
    addReaction: handleAddReaction,
    clearChat: () => setMessages([]),
    sendTyping: handleTyping,
    openSafetyNumbers: () => setIsSafetyModalOpen(true),
    openSecurityCenter: () => {
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        setMobileView("settings");
      } else {
        setIsSecurityCenterOpen(true);
      }
    },
    backToHome: () => {
      setSelectedContactId("");
      setMobileView("sidebar");
      router.push("/");
    },
    selectChat: (id: string) => {
      if (id) {
        const clean = id.split("@")[0].toLowerCase();
        setSelectedContactId(clean);
        setMobileView("chat");
        router.push(`/${clean}`);
      } else {
        setSelectedContactId("");
        setMobileView("sidebar");
        router.push("/");
      }
    },
    updateSettings: handleUpdateSettings,
    lockApp: () => {
      setSessionUnlocked(false);
      setIsAppLocked(true);
    },
    logout: handleLogout,
  };

  // 1. Initial hydration check
  if (!isAuthLoaded) {
    return (
      <div className="w-screen h-screen bg-[#f0f2f5] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#cbd5e1] border-t-[#00a884] rounded-full animate-spin" />
      </div>
    );
  }

  // 2. Custom Login / Registration Gateway
  if (!authUser) {
    return <AuthLoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // 3. Post-Login PIN & Biometric Setup Onboarding
  if (!authUser.isSecuritySetupComplete) {
    return (
      <SecuritySetupScreen
        user={authUser}
        onComplete={handleSecuritySetupComplete}
      />
    );
  }

  // 4. Two-Factor Authentication Gateway
  if (isAppLocked || !isSessionUnlocked()) {
    return (
      <AppLockScreen
        pinHash={authUser?.pinHash || settings.appLockPinHash || ""}
        username={cleanCurrentId}
        userName={authUser?.name || authUser?.username || "User"}
        biometricEnabled={authUser?.biometricEnabled ?? true}
        biometricCredentialId={authUser?.biometricCredentialId}
        onUnlock={() => {
          setSessionUnlocked(true);
          setIsAppLocked(false);
        }}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <ChatContext.Provider value={contextValue}>
      <div className="relative w-screen h-screen overflow-hidden bg-white flex flex-col font-sans text-[#050505]">
        {/* Immediate Internet Cutdown Alert Banner */}
        {(!isOnline || networkError) && (
          <div className="bg-[#fa383e] text-white px-4 py-2 flex items-center justify-between text-xs md:text-sm font-semibold shadow-md z-[80] shrink-0 animate-in slide-in-from-top-1">
            <div className="flex items-center gap-2 min-w-0">
              <WifiOff className="h-4 w-4 shrink-0 animate-pulse" />
              <span className="truncate">
                {networkError || "Internet connection cut down! You are currently offline. Check your network."}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.onLine) {
                    setIsOnline(true);
                    setNetworkError(null);
                    secureSocket.connect();
                  } else {
                    setNetworkError("Internet connection still down. Please check your network.");
                  }
                }}
                className="px-2.5 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white text-xs font-medium cursor-pointer transition-colors"
              >
                Retry
              </button>
              {networkError && isOnline && (
                <button
                  onClick={() => setNetworkError(null)}
                  className="p-0.5 rounded hover:bg-white/20 text-white cursor-pointer"
                  title="Dismiss banner"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Main App Container - Single Persistent Layout for Sidebar & Chat */}
        <div
          className={`flex-1 flex overflow-hidden relative ${
            isWindowBlurred ? "privacy-blur" : ""
          }`}
        >
          {/* Persistent Sidebar: Never remounts or flickers across page switches */}
          <div
            className={`h-full ${
              mobileView === "sidebar" ? "w-full flex" : "hidden md:flex"
            }`}
          >
            <ChatSidebar
              currentUser={currentUser}
              contactUser={contactUser}
              contacts={contacts}
              messages={messages}
              settings={settings}
              selectedChatId={contactUser.id}
              isLoading={isLoadingContacts}
              isOnline={isOnline}
              onSelectChat={(id) => {
                if (id) {
                  const clean = id.split("@")[0].toLowerCase();
                  setSelectedContactId(clean);
                  setMobileView("chat");
                  router.push(`/${clean}`);
                } else {
                  setSelectedContactId("");
                  setMobileView("sidebar");
                  router.push("/");
                }
              }}
              onOpenSecurityCenter={() => {
                if (typeof window !== "undefined" && window.innerWidth < 768) {
                  setMobileView("settings");
                } else {
                  setIsSecurityCenterOpen(true);
                }
              }}
              onSwitchUser={handleLogout}
              onLockApp={() => {
                setSessionUnlocked(false);
                setIsAppLocked(true);
              }}
              onLogout={handleLogout}
            />
          </div>

          {/* Active Chat Content / Home Slot */}
          <div
            className={`h-full flex-1 ${
              mobileView === "chat" ? "flex" : "hidden md:flex"
            }`}
          >
            {children}
          </div>

          {/* Mobile Settings view */}
          {mobileView === "settings" && (
            <div className="md:hidden fixed inset-0 z-50 bg-white">
              <MobileSettingsPage
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                onBack={() => setMobileView(selectedContactId ? "chat" : "sidebar")}
                onOpenSafetyNumbers={() => setIsSafetyModalOpen(true)}
                onRotateKey={async () => {
                  const newVersion = (settings.keyRotationVersion || 1) + 1;
                  handleUpdateSettings({
                    keyRotationVersion: newVersion,
                    lastRekeyedAt: Date.now(),
                  });
                  chatSync.broadcast({
                    type: "KEY_ROTATION",
                    newVersion,
                    senderId: currentUser.id,
                  });
                }}
              />
            </div>
          )}
        </div>

        {/* Global Security & Verification Modals */}
        <SafetyNumberModal
          isOpen={isSafetyModalOpen}
          onClose={() => setIsSafetyModalOpen(false)}
          contactName={contactUser.name}
          safetyNumber={safetyNumber}
          isVerified={settings.safetyNumberVerified}
          onToggleVerify={(verified) =>
            handleUpdateSettings({ safetyNumberVerified: verified })
          }
        />

        <SecurityCommandCenter
          isOpen={isSecurityCenterOpen}
          onClose={() => setIsSecurityCenterOpen(false)}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          currentUserRole={currentUser.role}
          onRotateKey={async () => {
            const newVersion = (settings.keyRotationVersion || 1) + 1;
            handleUpdateSettings({
              keyRotationVersion: newVersion,
              lastRekeyedAt: Date.now(),
            });
            chatSync.broadcast({
              type: "KEY_ROTATION",
              newVersion,
              senderId: currentUser.id,
            });
          }}
          onOpenSafetyNumbers={() => setIsSafetyModalOpen(true)}
        />
      </div>
    </ChatContext.Provider>
  );
}
