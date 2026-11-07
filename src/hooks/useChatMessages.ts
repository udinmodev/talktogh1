"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { User, Message, SecuritySettings, LinkMetadata } from "@/types/chat";
import { extractUrls, getClientLinkMetadata } from "@/components/chat/LinkPreviewCard";
import { soundManager } from "@/lib/sound";
import {
  encryptMessageContent,
  decryptMessageContent,
  getPairSessionKey,
  getPairSafetyNumber,
  preloadPairSessionKeys,
} from "@/lib/crypto";
import { chatSync } from "@/lib/broadcast";
import { secureSocket } from "@/lib/socket";
import { getInternalApiHeaders } from "@/lib/api-security";
import { useChatRealtimeSync } from "./useChatRealtimeSync";

interface UseChatMessagesProps {
  cleanCurrentId: string;
  currentUser: User;
  contactUser: User;
  activeChatId: string;
  routeContactId: string;
  settings: SecuritySettings;
  isOnline: boolean;
  setNetworkError: (msg: string | null) => void;
  setSelectedContactId: (id: string) => void;
  isAuthLoaded: boolean;
}

const FORBIDDEN_MOCK_ACCOUNTS = new Set([
  "alice", "bob", "elena", "marcus", "user", "anonymous", "none", "0", "non",
  "vijay", "vijaysing4hadv74", "vijaysinghad73", "vijaysinghad74"
]);

function getInitialCachedContacts(): User[] {
  if (typeof window === "undefined") return [];
  try {
    const sessionRaw = sessionStorage.getItem("wechat_current_auth_user_v2");
    const rawUser = sessionRaw || localStorage.getItem("wechat_current_auth_user_v2");
    if (rawUser) {
      const u = JSON.parse(rawUser);
      const uid = String(u?.username || "").split("@")[0].toLowerCase();
      if (uid) {
        const rawCached =
          sessionStorage.getItem(`wechat_cache_contacts_${uid}`) ||
          localStorage.getItem(`wechat_cache_contacts_${uid}`);
        if (rawCached) {
          const parsed = JSON.parse(rawCached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.filter(
              (c: User) => c && c.id && !FORBIDDEN_MOCK_ACCOUNTS.has(c.id.toLowerCase())
            );
          }
        }
      }
    }
  } catch {}
  return [];
}

export function useChatMessages({
  cleanCurrentId,
  currentUser,
  contactUser,
  activeChatId,
  routeContactId,
  settings,
  isOnline,
  setNetworkError,
  setSelectedContactId,
  isAuthLoaded,
}: UseChatMessagesProps) {
  // Dynamic real registered users directory with instant cached first-paint (0ms loading)
  const [contacts, setContacts] = useState<User[]>(() => getInitialCachedContacts());
  const [isLoadingContacts, setIsLoadingContacts] = useState<boolean>(() => {
    const initialCached = getInitialCachedContacts();
    return initialCached.length === 0;
  });

  // Crypto Keys in state
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null);
  const [safetyNumber, setSafetyNumber] = useState<string>(
    "51940 38472 90184 62819 02847 19482 65019 47201 83920 18274 01928 37482"
  );

  // Messages State with instant-refresh local session cache
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const sessionRaw = sessionStorage.getItem("wechat_current_auth_user_v2");
      const rawUser = sessionRaw || localStorage.getItem("wechat_current_auth_user_v2");
      if (rawUser) {
        const u = JSON.parse(rawUser);
        const uid = String(u?.username || "").split("@")[0].toLowerCase();
        if (uid) {
          const cached = sessionStorage.getItem(`wechat_cache_msgs_${uid}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          }
        }
      }
    } catch {}
    return [];
  });

  const [isPeerTyping, setIsPeerTyping] = useState<boolean>(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const sessionRaw = sessionStorage.getItem("wechat_current_auth_user_v2");
      const rawUser = sessionRaw || localStorage.getItem("wechat_current_auth_user_v2");
      if (rawUser) {
        const u = JSON.parse(rawUser);
        const uid = String(u?.username || "").split("@")[0].toLowerCase();
        if (uid) {
          const cached = sessionStorage.getItem(`wechat_cache_msgs_${uid}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) return false;
          }
        }
      }
    } catch {}
    return true;
  });

  const realtimeChannelRef = useRef<any>(null);
  const peerTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // In-memory decrypted message cache
  const decryptedCacheRef = useRef<Map<string, Message>>(new Map());
  const [hasMoreMap, setHasMoreMap] = useState<Record<string, boolean>>({});
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  // Load real registered user accounts
  const loadLiveContacts = useCallback(async (myId: string) => {
    const safetyTimer = setTimeout(() => {
      setIsLoadingContacts(false);
    }, 2500);

    const myCleanId = String(myId || "").split("@")[0].toLowerCase();
    if (!myCleanId || myCleanId === "user" || myCleanId === "none") {
      clearTimeout(safetyTimer);
      setIsLoadingContacts(false);
      return;
    }

    try {
      const targetQuery = routeContactId && routeContactId !== myCleanId ? `&targetId=${encodeURIComponent(routeContactId)}` : "";
      const res = await fetch(`/api/users?requesterId=${encodeURIComponent(myCleanId)}${targetQuery}`, {
        headers: getInternalApiHeaders({
          "x-wechat-requester-id": myCleanId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const rawList = Array.isArray(data.users) ? [...data.users] : [];
        if (data.targetUser && !rawList.some((u: any) => String(u.id || u.username || "").toLowerCase() === String(data.targetUser.id).toLowerCase())) {
          rawList.push(data.targetUser);
        }

        if (rawList.length > 0) {
          const registeredUsers: User[] = rawList
            .filter((u: any) => {
              const cId = String(u.id || u.username || "").split("@")[0].toLowerCase();
              return cId && cId !== myCleanId && !FORBIDDEN_MOCK_ACCOUNTS.has(cId);
            })
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
          // Persist contacts in local/session cache for 0ms instant loading
          try {
            const cacheStr = JSON.stringify(registeredUsers);
            sessionStorage.setItem(`wechat_cache_contacts_${myCleanId}`, cacheStr);
            localStorage.setItem(`wechat_cache_contacts_${myCleanId}`, cacheStr);
          } catch {}

          preloadPairSessionKeys(myCleanId, registeredUsers.map((u) => u.id));
          if (routeContactId && routeContactId !== myCleanId) {
            setSelectedContactId(routeContactId);
          }
        }
      }
    } catch (err) {
      console.warn("Contact load error:", err);
    } finally {
      clearTimeout(safetyTimer);
      setIsLoadingContacts(false);
    }
  }, [routeContactId, setSelectedContactId]);

  useEffect(() => {
    if (currentUser.id) {
      loadLiveContacts(currentUser.id);
    }
  }, [currentUser.id, loadLiveContacts]);

  // Dynamically derive shared E2EE session key for active chat
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

  // Process incoming wire messages from WebSocket or REST API
  const processIncomingWireBatch = useCallback(
    async (wireList: any[], isPrepend: boolean = false) => {
      if (!currentUser.id || currentUser.id === "user" || !wireList) {
        setIsLoadingMessages(false);
        return;
      }
      try {
        const cleanCurrent = String(currentUser.id || "").split("@")[0].toLowerCase();

        const distinctPartners: string[] = [];
        for (const wire of wireList) {
          if (decryptedCacheRef.current.has(wire.id)) continue;
          const isChannel = wire.recipientId?.startsWith("public-");
          const cleanSender = String(wire.senderId || "").split("@")[0].toLowerCase();
          const cleanRecipient = String(wire.recipientId || "").split("@")[0].toLowerCase();
          const partnerId = isChannel
            ? cleanRecipient
            : cleanSender === cleanCurrent
            ? cleanRecipient
            : cleanSender;
          if (partnerId && partnerId !== "none" && partnerId !== cleanCurrent && !distinctPartners.includes(partnerId)) {
            distinctPartners.push(partnerId);
          }
        }
        if (distinctPartners.length > 0) {
          await preloadPairSessionKeys(cleanCurrent, distinctPartners);
        }

        const decryptedList: Message[] = [];
        for (const wire of wireList) {
          try {
            if (decryptedCacheRef.current.has(wire.id)) {
              const cached = decryptedCacheRef.current.get(wire.id)!;
              decryptedList.push({
                ...cached,
                status: wire.status || cached.status,
                reactions: wire.reactions || cached.reactions,
                isPinned: wire.isPinned !== undefined ? wire.isPinned : cached.isPinned,
                isBurned: wire.isBurned !== undefined ? wire.isBurned : cached.isBurned,
              });
              continue;
            }

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
            const decryptedMsg: Message = {
              ...wire,
              senderId: cleanSender,
              recipientId: cleanRecipient,
              encryptedPayload: ep,
              text: decrypted.text,
              linkMetadata: decrypted.linkMetadata,
              mediaType: decrypted.mediaType || wire.mediaType,
              mediaUrl: decrypted.mediaUrl || wire.mediaUrl,
              reactions: wire.reactions || {},
            };

            decryptedCacheRef.current.set(wire.id, decryptedMsg);
            decryptedList.push(decryptedMsg);
          } catch {
            // Encrypted for another contact
          }
        }

        setMessages((prev) => {
          const map = new Map<string, Message>();
          if (isPrepend) {
            for (const m of decryptedList) map.set(m.id, m);
            for (const m of prev) map.set(m.id, m);
          } else {
            for (const m of prev) map.set(m.id, m);
            for (const m of decryptedList) map.set(m.id, m);
          }
          const merged = Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
          try {
            if (cleanCurrentId && cleanCurrentId !== "user" && merged.length > 0) {
              sessionStorage.setItem(`wechat_cache_msgs_${cleanCurrentId}`, JSON.stringify(merged));
            }
          } catch {}
          return merged;
        });
      } catch (err) {
        console.warn("Wire batch decrypt error:", err);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [currentUser.id, cleanCurrentId]
  );

  // Keep session cache in sync and prime memory cache
  useEffect(() => {
    if (typeof window === "undefined" || !cleanCurrentId || cleanCurrentId === "user") return;
    try {
      if (messages.length > 0) {
        sessionStorage.setItem(`wechat_cache_msgs_${cleanCurrentId}`, JSON.stringify(messages));
        for (const m of messages) {
          if (m.id && !decryptedCacheRef.current.has(m.id)) {
            decryptedCacheRef.current.set(m.id, m);
          }
        }
      }
    } catch {}
  }, [messages, cleanCurrentId]);

  // Load initial messages via secure REST endpoint and WebSocket sync
  const loadInitialMessages = useCallback(
    async (myId: string) => {
      if (!myId || myId === "user") {
        setIsLoadingMessages(false);
        return;
      }

      setIsLoadingMessages(true);
      const cleanId = String(myId).split("@")[0].toLowerCase();

      const timer = setTimeout(() => {
        setIsLoadingMessages(false);
      }, 2000);

      try {
        secureSocket.registerUser(cleanId);
        secureSocket.requestMessageSync(cleanId);

        const res = await fetch(`/api/messages?userId=${encodeURIComponent(cleanId)}&limit=40`, {
          headers: getInternalApiHeaders(),
        });

        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.messages)) {
            await processIncomingWireBatch(data.messages);
            if (data.hasMore !== undefined) {
              setHasMoreMap((prev) => ({ ...prev, [cleanId]: Boolean(data.hasMore) }));
            }
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

  // Optimized pagination: Fetch older messages on scroll
  const loadMoreMessages = useCallback(async () => {
    if (
      isLoadingMore ||
      !activeChatId ||
      activeChatId === "none" ||
      !cleanCurrentId ||
      cleanCurrentId === "user"
    ) {
      return;
    }

    if (hasMoreMap[activeChatId] === false) return;

    const chatMsgs = messages.filter((m) => {
      const s = String(m.senderId || "").split("@")[0].toLowerCase();
      const r = String(m.recipientId || "").split("@")[0].toLowerCase();
      return (
        (s === activeChatId && r === cleanCurrentId) ||
        (s === cleanCurrentId && r === activeChatId) ||
        (activeChatId.startsWith("public-") && r === activeChatId)
      );
    });

    if (chatMsgs.length === 0) return;

    const oldestTimestamp = chatMsgs[0].timestamp;
    setIsLoadingMore(true);

    try {
      const res = await fetch(
        `/api/messages?userId=${encodeURIComponent(cleanCurrentId)}&contactId=${encodeURIComponent(
          activeChatId
        )}&before=${oldestTimestamp}&limit=30`,
        { headers: getInternalApiHeaders() }
      );

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.messages) && data.messages.length > 0) {
          await processIncomingWireBatch(data.messages, true);
        }
        const more = Boolean(data.hasMore && data.messages && data.messages.length > 0);
        setHasMoreMap((prev) => ({ ...prev, [activeChatId]: more }));
      } else {
        setHasMoreMap((prev) => ({ ...prev, [activeChatId]: false }));
      }
    } catch (err) {
      console.warn("Load more messages error:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, activeChatId, cleanCurrentId, messages, hasMoreMap, processIncomingWireBatch]);

  useEffect(() => {
    if (!isAuthLoaded) return;
    if (currentUser.id && currentUser.id !== "user") {
      loadInitialMessages(currentUser.id);
    } else {
      setIsLoadingMessages(false);
    }
  }, [currentUser.id, isAuthLoaded, loadInitialMessages]);

  // Hook: Connect Supabase Realtime, BroadcastChannel, and Expiration timers
  useChatRealtimeSync({
    currentUser,
    cleanCurrentId,
    activeChatId,
    settings,
    messages,
    setMessages,
    setIsPeerTyping,
    loadLiveContacts,
    processIncomingWireBatch,
    realtimeChannelRef,
    peerTypingTimeoutRef,
  });

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

      if (targetId === myId) {
        console.warn("Blocked message sending: Cannot send messages to yourself.");
        return;
      }

      // Verification: recipient must be a real registered contact, not fake or non-existent
      let contactExists = contacts.some((c) => c.id === targetId);
      if (!contactExists) {
        try {
          const verifyRes = await fetch(
            `/api/users?requesterId=${encodeURIComponent(myId)}&targetId=${encodeURIComponent(targetId)}`,
            {
              headers: getInternalApiHeaders({
                "x-wechat-requester-id": myId,
              }),
            }
          );
          if (verifyRes.ok) {
            const verifyData = await verifyRes.json();
            const matchedUser =
              verifyData.targetUser ||
              verifyData.users?.find(
                (u: any) => String(u.id || u.username || "").split("@")[0].toLowerCase() === targetId
              );

            if (matchedUser) {
              contactExists = true;
              setContacts((prev) => {
                if (prev.some((c) => c.id === targetId)) return prev;
                return [
                  ...prev,
                  {
                    id: targetId,
                    name: matchedUser.name || targetId,
                    role: "contact" as const,
                    avatar:
                      matchedUser.avatar ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(matchedUser.name || targetId)}`,
                    phone: `@${targetId}`,
                    about: matchedUser.about || "Registered confidential identity.",
                    publicKeyFingerprint: matchedUser.publicKeyFingerprint || "7EFE2C6DCC10DA73",
                    isOnline: true,
                    lastSeen: "online",
                  },
                ];
              });
            }
          }
        } catch (vErr) {
          console.warn("Notice dynamically verifying recipient:", vErr);
        }
      }

      if (!contactExists && !isLoadingContacts && contacts.length > 0) {
        console.warn(`Blocked message sending: Recipient @${targetId} does not exist in registered directory.`);
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
    [sessionKey, cleanCurrentId, contactUser?.id, activeChatId, settings.disappearingTimer, settings.soundEffects, isOnline, contacts, isLoadingContacts, setNetworkError]
  );

  const handleTogglePinMessage = useCallback((messageId: string) => {
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
  }, []);

  const handleBurnMessage = useCallback((messageId: string) => {
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
  }, []);

  const handleTyping = useCallback((isTyping: boolean) => {
    chatSync.broadcast({
      type: "TYPING_INDICATOR",
      senderId: cleanCurrentId,
      isTyping,
    });

    if (realtimeChannelRef.current) {
      try {
        realtimeChannelRef.current.send({
          type: "broadcast",
          event: "typing",
          payload: {
            senderId: cleanCurrentId,
            recipientId: activeChatId,
            isTyping,
          },
        });
      } catch (err) {
        console.warn("Typing broadcast notice:", err);
      }
    }
  }, [cleanCurrentId, activeChatId]);

  const handleAddReaction = useCallback((messageId: string, emoji: string) => {
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
  }, [currentUser.id]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));

    chatSync.broadcast({
      type: "DELETE_MESSAGE",
      messageId,
    });

    fetch("/api/messages", {
      method: "POST",
      headers: getInternalApiHeaders(),
      body: JSON.stringify({ action: "delete", messageId }),
    }).catch((err) => console.warn("Cloud message delete notice:", err));
  }, []);

  const handleEditMessage = useCallback(async (messageId: string, newText: string): Promise<boolean> => {
    if (!newText.trim()) return false;
    const targetMsg = messages.find((m) => m.id === messageId);
    if (!targetMsg) return false;

    let activeKey = sessionKey;
    const myId = cleanCurrentId;
    const targetId = (
      targetMsg.recipientId === myId ? targetMsg.senderId : targetMsg.recipientId
    ).split("@")[0].toLowerCase();

    if (!activeKey) {
      try {
        activeKey = await getPairSessionKey(myId, targetId);
      } catch (err) {
        console.warn("Failed to derive key for edit:", err);
      }
    }
    if (!activeKey) return false;

    try {
      const detectedUrls = extractUrls(newText);
      const linkMetadata =
        detectedUrls.length > 0
          ? detectedUrls.slice(0, 3).map((u) => getClientLinkMetadata(u))
          : undefined;

      const payload = await encryptMessageContent(
        {
          text: newText.trim(),
          linkMetadata,
          mediaType: targetMsg.mediaType,
          mediaUrl: targetMsg.mediaUrl,
        },
        activeKey,
        targetMsg.senderId,
        targetMsg.recipientId
      );

      const editedAt = Date.now();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                text: newText.trim(),
                encryptedPayload: payload,
                linkMetadata,
                isEdited: true,
                editedAt,
              }
            : m
        )
      );

      chatSync.broadcast({
        type: "EDIT_MESSAGE",
        messageId,
        payload,
        newText: newText.trim(),
      });

      fetch("/api/messages", {
        method: "POST",
        headers: getInternalApiHeaders(),
        body: JSON.stringify({
          action: "edit",
          messageId,
          encryptedPayload: payload,
        }),
      }).catch((err) => console.warn("Cloud message edit notice:", err));

      return true;
    } catch (err) {
      console.error("Edit encryption failed:", err);
      return false;
    }
  }, [messages, sessionKey, cleanCurrentId]);

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

  return {
    contacts,
    setContacts,
    isLoadingContacts,
    loadLiveContacts,
    sessionKey,
    safetyNumber,
    messages,
    setMessages,
    activeMessages,
    isLoadingMessages,
    hasMoreMessages: activeChatId ? hasMoreMap[activeChatId] !== false : false,
    isLoadingMoreMessages: isLoadingMore,
    loadMoreMessages,
    isPeerTyping,
    handleSendMessage,
    handleTogglePinMessage,
    handleBurnMessage,
    handleTyping,
    handleAddReaction,
    handleDeleteMessage,
    handleEditMessage,
  };
}
