"use client";

import { useEffect, useRef, useState } from "react";
import { User, Message, SecuritySettings } from "@/types/chat";
import { soundManager } from "@/lib/sound";
import {
  decryptMessageContent,
  getPairSessionKey,
} from "@/lib/crypto";
import { chatSync } from "@/lib/broadcast";
import { getSupabaseClient } from "@/lib/supabase";
import { fromSupabaseRow, SupabaseWireRow } from "@/types/wire";
import { getInternalApiHeaders } from "@/lib/api-security";

interface UseChatRealtimeSyncProps {
  currentUser: User;
  cleanCurrentId: string;
  activeChatId: string;
  settings: SecuritySettings;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsPeerTyping: React.Dispatch<React.SetStateAction<boolean>>;
  loadLiveContacts: (id: string) => void;
  processIncomingWireBatch: (wireList: any[], isPrepend?: boolean) => Promise<void>;
  onRealtimeSubscribed?: () => void;
  realtimeChannelRef: React.MutableRefObject<any>;
  peerTypingTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
}

export function useChatRealtimeSync({
  currentUser,
  cleanCurrentId,
  activeChatId,
  settings,
  messages,
  setMessages,
  setIsPeerTyping,
  loadLiveContacts,
  processIncomingWireBatch,
  onRealtimeSubscribed,
  realtimeChannelRef,
  peerTypingTimeoutRef,
}: UseChatRealtimeSyncProps) {
  const didInitialRealtimeSubscribeRef = useRef(false);

  // 1. Supabase Realtime Listener
  useEffect(() => {
    if (!currentUser.id || currentUser.id === "user") return;
    const client = getSupabaseClient();
    if (!client) return;

    const channelName = "realtime-chat-shared";
    const channel = client.channel(channelName);
    realtimeChannelRef.current = channel;

    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload) return;
        const s = String(payload.senderId || "").split("@")[0].toLowerCase();
        const r = String(payload.recipientId || "").split("@")[0].toLowerCase();
        const current = String(currentUser.id || "").split("@")[0].toLowerCase();
        const active = String(activeChatId || "").split("@")[0].toLowerCase();

        if (s === active && (!r || r === current)) {
          setIsPeerTyping(Boolean(payload.isTyping));
          if (peerTypingTimeoutRef.current) clearTimeout(peerTypingTimeoutRef.current);
          if (payload.isTyping) {
            peerTypingTimeoutRef.current = setTimeout(() => {
              setIsPeerTyping(false);
            }, 3000);
          }
        }
      })
      .on("broadcast", { event: "seen" }, ({ payload }) => {
        if (!payload) return;
        const reader = String(payload.readerId || "").split("@")[0].toLowerCase();
        const target = String(payload.senderId || "").split("@")[0].toLowerCase();
        const current = String(currentUser.id || "").split("@")[0].toLowerCase();
        const active = String(activeChatId || "").split("@")[0].toLowerCase();

        if (reader === active && target === current) {
          setMessages((prev) =>
            prev.map((m) => {
              const s = String(m.senderId || "").split("@")[0].toLowerCase();
              const r = String(m.recipientId || "").split("@")[0].toLowerCase();
              if (s === current && r === active && m.status !== "read") {
                return { ...m, status: "read" };
              }
              return m;
            })
          );
        }
      })
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
        async (payload) => {
          const updatedRow = payload.new as SupabaseWireRow;
          if (!updatedRow || !updatedRow.id) return;
          const wire = fromSupabaseRow(updatedRow);

          let newText: string | undefined = undefined;
          let newPayload = wire.encryptedPayload;
          if (typeof newPayload === "string") {
            try {
              newPayload = JSON.parse(newPayload);
            } catch {}
          }

          if (wire.isEdited && newPayload && newPayload.iv && newPayload.ciphertext) {
            try {
              const cleanSender = String(wire.senderId || "").split("@")[0].toLowerCase();
              const cleanRecipient = String(wire.recipientId || "").split("@")[0].toLowerCase();
              const cleanCurrent = String(currentUser.id || "").split("@")[0].toLowerCase();
              const partnerId = cleanRecipient === cleanCurrent ? cleanSender : cleanRecipient;
              const chatKey = await getPairSessionKey(cleanCurrent, partnerId);
              const dec = await decryptMessageContent(newPayload, chatKey);
              newText = dec.text;
            } catch (err) {
              console.warn("Realtime edit decrypt notice:", err);
            }
          }

          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === wire.id) {
                return {
                  ...m,
                  text: newText !== undefined ? newText : m.text,
                  encryptedPayload: newPayload || m.encryptedPayload,
                  isEdited: wire.isEdited ?? m.isEdited,
                  editedAt: wire.editedAt ?? m.editedAt,
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
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        if (didInitialRealtimeSubscribeRef.current) {
          onRealtimeSubscribed?.();
        }
        didInitialRealtimeSubscribeRef.current = true;
      });

    return () => {
      realtimeChannelRef.current = null;
      client.removeChannel(channel);
    };
  }, [currentUser.id, activeChatId, settings.soundEffects, settings.disappearingTimer, loadLiveContacts, onRealtimeSubscribed, realtimeChannelRef, peerTypingTimeoutRef, setMessages, setIsPeerTyping]);

  // 2. Event-Driven Message Expiration
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
  }, [messages, setMessages]);

  // 3. Multi-Tab Sync with BroadcastChannel
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
        const s = String(action.senderId || "").split("@")[0].toLowerCase();
        const active = String(activeChatId || "").split("@")[0].toLowerCase();
        if (s === active) {
          setIsPeerTyping(Boolean(action.isTyping));
          if (peerTypingTimeoutRef.current) clearTimeout(peerTypingTimeoutRef.current);
          if (action.isTyping) {
            peerTypingTimeoutRef.current = setTimeout(() => {
              setIsPeerTyping(false);
            }, 3000);
          }
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
      } else if (action.type === "DELETE_MESSAGE") {
        setMessages((prev) => prev.filter((m) => m.id !== action.messageId));
      } else if (action.type === "EDIT_MESSAGE") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === action.messageId
              ? {
                  ...m,
                  text: action.newText,
                  encryptedPayload: action.payload,
                  isEdited: true,
                  editedAt: Date.now(),
                }
              : m
          )
        );
      } else if (action.type === "WIPE_ALL") {
        setMessages([]);
      }
    });

    return () => unsubscribe();
  }, [settings.disappearingTimer, cleanCurrentId, processIncomingWireBatch, currentUser.id, activeChatId, setMessages, setIsPeerTyping, peerTypingTimeoutRef]);

  const [isTabVisible, setIsTabVisible] = useState<boolean>(
    () => typeof document === "undefined" || document.visibilityState === "visible"
  );

  useEffect(() => {
    const handleVisibility = () => {
      setIsTabVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // 4. Mark incoming messages as read (only while the chat is actually visible)
  useEffect(() => {
    if (!isTabVisible) return;
    if (!cleanCurrentId || cleanCurrentId === "user" || !activeChatId || activeChatId === "none") return;

    const unreadIncoming = messages.filter(
      (m) =>
        String(m.senderId || "").split("@")[0].toLowerCase() === activeChatId &&
        String(m.recipientId || "").split("@")[0].toLowerCase() === cleanCurrentId &&
        m.status !== "read"
    );

    if (unreadIncoming.length === 0) return;

    setMessages((prev) =>
      prev.map((m) => {
        const s = String(m.senderId || "").split("@")[0].toLowerCase();
        const r = String(m.recipientId || "").split("@")[0].toLowerCase();
        if (s === activeChatId && r === cleanCurrentId && m.status !== "read") {
          return { ...m, status: "read" };
        }
        return m;
      })
    );

    if (realtimeChannelRef.current) {
      try {
        realtimeChannelRef.current.send({
          type: "broadcast",
          event: "seen",
          payload: {
            readerId: cleanCurrentId,
            senderId: activeChatId,
          },
        });
      } catch (err) {
        console.warn("Seen broadcast notice:", err);
      }
    }

    unreadIncoming.forEach((msg) => {
      chatSync.broadcast({
        type: "MESSAGE_STATUS_UPDATE",
        messageId: msg.id,
        status: "read",
      });
    });

    fetch("/api/messages", {
      method: "POST",
      headers: getInternalApiHeaders(),
      body: JSON.stringify({
        action: "read",
        recipientId: cleanCurrentId,
        senderId: activeChatId,
      }),
    }).catch((err) => console.warn("Cloud mark-read notice:", err));
  }, [isTabVisible, cleanCurrentId, activeChatId, messages, realtimeChannelRef, setMessages]);
}
