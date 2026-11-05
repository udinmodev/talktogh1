"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { User, Message, SecuritySettings, LinkMetadata, DEFAULT_SETTINGS } from "@/types/chat";
import { extractUrls, getClientLinkMetadata } from "@/components/chat/LinkPreviewCard";
import { soundManager } from "@/lib/sound";
import {
  generateEcdhKeyPair,
  getOrCreateIdentityKeyPair,
  rotateStoredIdentityKey,
  deriveSessionKey,
  generateSafetyNumber,
  encryptMessageContent,
  decryptMessageContent,
  EncryptedPayload,
} from "@/lib/crypto";
import { chatSync } from "@/lib/broadcast";
import { secureSocket } from "@/lib/socket";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatArea } from "@/components/chat/ChatArea";
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
import { EyeOff } from "lucide-react";

// Professional profiles for multi-contact secure communication
const ALL_CONTACTS: User[] = [
  {
    id: "bob",
    name: "Bob Mercer",
    role: "contact",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    phone: "+1 (555) 084-9382",
    about: "Using secure private messenger.",
    publicKeyFingerprint: "E730D8192BF04C61",
    isOnline: true,
    lastSeen: "online",
  },
  {
    id: "elena",
    name: "Elena Rostova",
    role: "contact",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
    phone: "+1 (555) 041-8821",
    about: "Security researcher & cryptographic auditor.",
    publicKeyFingerprint: "F49A28B10C739D12",
    isOnline: true,
    lastSeen: "online",
  },
  {
    id: "marcus",
    name: "Marcus Brody",
    role: "contact",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    phone: "+1 (555) 092-4411",
    about: "Executive project lead.",
    publicKeyFingerprint: "BC319082F81D6620",
    isOnline: false,
    lastSeen: "2 hours ago",
  },
];

const ALICE_PROFILE: User = {
  id: "alice",
  name: "Alice Vance",
  role: "owner",
  avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  phone: "+1 (555) 019-2834",
  about: "Available for secure messaging.",
  publicKeyFingerprint: "A9F438B2C19E77A0",
  isOnline: true,
};

export default function SecureChatApp() {
  // User Authentication & Session State
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);

  // Current active user identity (Alice by default, can switch to Bob)
  const [currentUserId, setCurrentUserId] = useState<string>("alice");
  const [selectedContactId, setSelectedContactId] = useState<string>("bob");
  const [mobileView, setMobileView] = useState<"sidebar" | "chat" | "settings">("chat");

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
    handleUpdateSettings({ appLockPin: updatedUser.pin });
  };

  const handleLogout = () => {
    logoutUser();
    setAuthUser(null);
    setIsAppLocked(false);
  };

  // Crypto Keys in state
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null);
  const [safetyNumber, setSafetyNumber] = useState<string>(
    "51940 38472 90184 62819 02847 19482 65019 47201 83920 18274 01928 37482"
  );
  const [isKeysInitialized, setIsKeysInitialized] = useState<boolean>(false);

  // Security & Customization Settings with LocalStorage Persistence
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SETTINGS);

  // Load saved preferences on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("wechat_app_settings_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.warn("Failed to read settings from storage:", e);
    }
  }, []);

  const handleUpdateSettings = useCallback((newOpts: Partial<SecuritySettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newOpts };
      try {
        localStorage.setItem("wechat_app_settings_v2", JSON.stringify(updated));
      } catch (e) {
        console.warn("Failed to write settings to storage:", e);
      }
      return updated;
    });
  }, []);

  // App Lock State
  const [isAppLocked, setIsAppLocked] = useState<boolean>(false);
  const [isWindowBlurred, setIsWindowBlurred] = useState<boolean>(false);

  // Modals state
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [isSecurityCenterOpen, setIsSecurityCenterOpen] = useState(false);

  // Messages State
  const [messages, setMessages] = useState<Message[]>([]);
  const [isPeerTyping, setIsPeerTyping] = useState<boolean>(false);

  const currentUser: User = {
    id: authUser ? authUser.username : (currentUserId === "alice" ? "alice" : "bob"),
    name: authUser ? authUser.name : (currentUserId === "alice" ? ALICE_PROFILE.name : ALL_CONTACTS[0].name),
    role: authUser?.role || (currentUserId === "alice" ? "owner" : "contact"),
    avatar: authUser?.avatar || (currentUserId === "alice" ? ALICE_PROFILE.avatar : ALL_CONTACTS[0].avatar),
    phone: "+1 (555) 019-2834",
    about: "Using secure private messenger.",
    publicKeyFingerprint: (authUser ? authUser.username : currentUserId) === "bob" ? "E730D8192BF04C61" : "A9F438B2C19E77A0",
    isOnline: true,
  };

  const contactUser =
    ALL_CONTACTS.find((c) => c.id !== currentUser.id) || ALL_CONTACTS[0];

  // Register identity with WebSocket relay server
  useEffect(() => {
    secureSocket.registerUser(currentUser.id);
  }, [currentUser.id]);

  // Guard against multiple fetch calls in React Strict Mode
  const hasInitializedRef = useRef(false);

  // 1. Initialize Cryptographic Session Keys (ECDH P-256 & Shared AES-GCM Key)
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    async function initCrypto() {
      try {
        const aliceKp = await getOrCreateIdentityKeyPair("alice");
        const bobKp = await getOrCreateIdentityKeyPair("bob");

        // Derive deterministic E2EE shared session key from persistent identity keys
        const derivedKey = await deriveSessionKey(
          aliceKp.keyPair.privateKey,
          bobKp.keyPair.publicKey
        );
        setSessionKey(derivedKey);

        // Derive 60-digit safety code
        const code = await generateSafetyNumber(
          aliceKp.data.fingerprint,
          bobKp.data.fingerprint
        );
        setSafetyNumber(code);

        // Fetch zero-knowledge encrypted wire messages from backend API
        let apiMsgs: Message[] = [];
        try {
          const res = await fetch("/api/messages");
          if (res.ok) {
            const data = await res.json();
            if (data.messages && data.messages.length > 0) {
              const decryptedList: Message[] = [];
              let hasUnverifiable = false;

              for (const wire of data.messages) {
                try {
                  const decrypted = await decryptMessageContent(wire.encryptedPayload, derivedKey);
                  decryptedList.push({
                    ...wire,
                    text: decrypted.text,
                    linkMetadata: decrypted.linkMetadata,
                  });
                } catch {
                  hasUnverifiable = true;
                }
              }

              // Purge legacy unverifiable messages from server storage if keys were rotated
              if (hasUnverifiable && decryptedList.length === 0) {
                fetch("/api/messages", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "wipe" }),
                }).catch(() => {});
              } else if (decryptedList.length > 0) {
                apiMsgs = decryptedList;
              }
            }
          }
        } catch (apiErr) {
          console.warn("API check notice:", apiErr);
        }

        if (apiMsgs.length > 0) {
          setMessages(apiMsgs);
        } else {
          // Initial conversation history - encrypted with pure client-side metadata
          const initialPlaintexts: Array<{
            sender: string;
            recipient: string;
            text: string;
            linkMetadata?: LinkMetadata[];
          }> = [
            {
              sender: "alice",
              recipient: "bob",
              text: "Hi Bob, let's keep all project deliberations and confidential contracts in this channel.",
            },
            {
              sender: "bob",
              recipient: "alice",
              text: "Understood, Alice. You can reference the repository specifications here: https://github.com - sending over the security notes.",
              linkMetadata: [getClientLinkMetadata("https://github.com")],
            },
            {
              sender: "alice",
              recipient: "bob",
              text: "Perfect. I have verified the safety numbers and enabled multi-type message encryption.",
            },
          ];

          const batchMsgs: Message[] = [];
          for (let i = 0; i < initialPlaintexts.length; i++) {
            const item = initialPlaintexts[i];
            // Encrypt both text and link metadata inside ciphertext
            const payload = await encryptMessageContent(
              { text: item.text, linkMetadata: item.linkMetadata },
              derivedKey,
              item.sender,
              item.recipient
            );

            batchMsgs.push({
              id: `msg-${Date.now()}-${i}`,
              senderId: item.sender,
              recipientId: item.recipient,
              text: item.text,
              encryptedPayload: payload,
              timestamp: Date.now() - (3 - i) * 60000,
              status: "read",
              disappearingDuration: null,
              expiresAt: null,
              linkMetadata: item.linkMetadata,
            });
          }

          setMessages(batchMsgs);

          // Zero-Knowledge Batch Persist: send ONLY ciphertext wire objects over HTTP
          const wireEnvelopes = batchMsgs.map((m) => ({
            id: m.id,
            senderId: m.senderId,
            recipientId: m.recipientId,
            encryptedPayload: m.encryptedPayload,
            timestamp: m.timestamp,
            status: m.status,
            disappearingDuration: m.disappearingDuration,
            expiresAt: m.expiresAt,
            viewOnce: m.viewOnce,
            isBurned: m.isBurned,
            isPinned: m.isPinned,
            securityType: m.securityType,
          }));

          fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "batch", messages: wireEnvelopes }),
          }).catch(() => {});
        }

        setIsKeysInitialized(true);
      } catch (err) {
        console.error("Crypto init error:", err);
      }
    }

    initCrypto();
  }, []);

  // 2. Event-Driven Message Expiration (Exact Timeout Schedule per Message, Zero Polling)
  const scheduledTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    // Schedule precise event timers only for messages that have an expiration
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

    // Cleanup cancelled/already removed messages
    return () => {
      scheduledTimeoutsRef.current.forEach((t) => clearTimeout(t));
      scheduledTimeoutsRef.current.clear();
    };
  }, [messages]);

  // 3. Privacy Curtain (Auto-blur when tab loses focus or minimized)
  useEffect(() => {
    const handleBlur = () => {
      if (settings.privacyCurtain) {
        setIsWindowBlurred(true);
      }
    };
    const handleFocus = () => {
      setIsWindowBlurred(false);
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [settings.privacyCurtain]);

  // 4. Inactivity Auto-Lock (Event-driven timeout reset on mouse/keyboard activity)
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

  // 4. Real-time Multi-Tab Sync with BroadcastChannel
  useEffect(() => {
    const unsubscribe = chatSync.subscribe(async (action) => {
      if (action.type === "NEW_MESSAGE") {
        if (!sessionKey) return;
        try {
          const decrypted = await decryptMessageContent(action.payload, sessionKey);
          const duration =
            action.disappearingDuration !== undefined
              ? action.disappearingDuration
              : settings.disappearingTimer || null;

          const newMsg: Message = {
            id: action.messageId,
            senderId: action.payload.senderId,
            recipientId: action.payload.recipientId,
            text: decrypted.text,
            encryptedPayload: action.payload,
            timestamp: action.payload.timestamp,
            status: "read",
            disappearingDuration: duration,
            expiresAt: duration ? Date.now() + duration * 1000 : null,
            viewOnce: action.viewOnce,
            securityType: action.securityType,
            linkMetadata: decrypted.linkMetadata,
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // Play subtle receive chime if sound effects enabled and message is from peer
          if (settings.soundEffects !== false && action.payload.senderId !== currentUser.id) {
            soundManager.playReceive();
          }

          // Acknowledge read back
          chatSync.broadcast({
            type: "MESSAGE_STATUS_UPDATE",
            messageId: action.messageId,
            status: "read",
          });
        } catch (err) {
          console.error("Failed to decrypt received broadcast message:", err);
        }
      } else if (action.type === "TOGGLE_PIN") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === action.messageId ? { ...m, isPinned: action.isPinned } : m
          )
        );
      } else if (action.type === "VIEW_ONCE_OPENED") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === action.messageId ? { ...m, isBurned: true } : m
          )
        );
      } else if (action.type === "MESSAGE_STATUS_UPDATE") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === action.messageId ? { ...m, status: action.status } : m
          )
        );
      } else if (action.type === "TYPING_INDICATOR") {
        if (action.senderId !== currentUserId) {
          setIsPeerTyping(action.isTyping);
        }
      } else if (action.type === "KEY_ROTATION") {
        setSettings((prev) => ({
          ...prev,
          keyRotationVersion: action.newVersion,
          lastRekeyedAt: Date.now(),
        }));
      } else if (action.type === "WIPE_ALL") {
        setMessages([]);
      }
    });

    return () => unsubscribe();
  }, [sessionKey, settings.disappearingTimer, currentUserId]);

  // Microtask batch queue for outgoing message sync to API
  const messageSyncQueueRef = useRef<Message[]>([]);
  const batchSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const flushMessageSyncQueue = useCallback(() => {
    if (messageSyncQueueRef.current.length === 0) return;
    const batch = [...messageSyncQueueRef.current];
    messageSyncQueueRef.current = [];

    // ZERO-KNOWLEDGE WIRE ENVELOPE: Strip plaintext text and metadata before HTTP transmission
    const wireBatch = batch.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      recipientId: m.recipientId,
      encryptedPayload: m.encryptedPayload,
      timestamp: m.timestamp,
      status: m.status,
      disappearingDuration: m.disappearingDuration,
      expiresAt: m.expiresAt,
      viewOnce: m.viewOnce,
      isBurned: m.isBurned,
      isPinned: m.isPinned,
      securityType: m.securityType,
      mediaType: m.mediaType,
      mediaUrl: m.mediaUrl,
      reactions: m.reactions,
    }));

    fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "batch", messages: wireBatch }),
    }).catch((err) => console.warn("Batch sync notice:", err));
  }, []);

  const queueMessageForSync = useCallback(
    (msg: Message) => {
      messageSyncQueueRef.current.push(msg);
      if (batchSyncTimeoutRef.current) clearTimeout(batchSyncTimeoutRef.current);
      // Flush in microtask batch (50ms window)
      batchSyncTimeoutRef.current = setTimeout(flushMessageSyncQueue, 50);
    },
    [flushMessageSyncQueue]
  );

  // Send Message Handler
  const handleSendMessage = useCallback(
    async (
      text: string,
      mediaType?: "image" | "voice" | "doc",
      mediaUrl?: string,
      viewOnce?: boolean,
      customDuration?: number | null
    ) => {
      if (!sessionKey) return;

      try {
        const newMsgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        
        // Effective duration: custom duration takes precedence over conversation default
        const effectiveDuration =
          customDuration !== undefined && customDuration !== null
            ? customDuration
            : settings.disappearingTimer > 0
            ? settings.disappearingTimer
            : null;

        const hasExpiry = effectiveDuration !== null && effectiveDuration > 0;

        // Pure client-side link metadata generation (Zero server scraping)
        const detectedUrls = extractUrls(text);
        const linkMetadata: LinkMetadata[] | undefined =
          detectedUrls.length > 0
            ? detectedUrls.slice(0, 3).map((u) => getClientLinkMetadata(u))
            : undefined;

        // ENCRYPT BOTH TEXT AND LINK METADATA TOGETHER INTO AES-256-GCM CIPHERTEXT
        const payload = await encryptMessageContent(
          { text, linkMetadata },
          sessionKey,
          currentUser.id,
          contactUser.id
        );

        const newMsg: Message = {
          id: newMsgId,
          senderId: currentUser.id,
          recipientId: contactUser.id,
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

        // Play send sound cue if enabled
        if (settings.soundEffects !== false) {
          soundManager.playSend();
        }

        // Queue in batch sync with plaintext stripped
        queueMessageForSync(newMsg);

        // Broadcast encrypted payload over channel (ciphertext contains both text and link metadata)
        chatSync.broadcast({
          type: "NEW_MESSAGE",
          payload,
          messageId: newMsgId,
          viewOnce,
          disappearingDuration: effectiveDuration,
          securityType: newMsg.securityType,
        });
      } catch (err) {
        console.error("Encryption failed:", err);
      }
    },
    [sessionKey, currentUser.id, contactUser.id, settings.disappearingTimer, queueMessageForSync]
  );

  // Pin / Unpin Message Handler
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

    // Persist pin status to backend API
    fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pin", messageId, isPinned: nextPinnedState }),
    }).catch(() => {});

    chatSync.broadcast({
      type: "TOGGLE_PIN",
      messageId,
      isPinned: nextPinnedState,
    });
  };

  // View-Once Burn Handler (Burns message immediately upon being revealed)
  const handleBurnMessage = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, isBurned: true } : m
      )
    );
    // Persist burn to backend API
    fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "burn", messageId }),
    }).catch(() => {});

    chatSync.broadcast({
      type: "VIEW_ONCE_OPENED",
      messageId,
    });
  };

  // Rotate Key / Forward Secrecy Action
  const handleRotateKey = async () => {
    try {
      const nextVersion = settings.keyRotationVersion + 1;
      const newAlice = await generateEcdhKeyPair();
      const newBob = await generateEcdhKeyPair();
      const newSessionKey = await deriveSessionKey(
        newAlice.keyPair.privateKey,
        newBob.keyPair.publicKey,
        nextVersion
      );
      setSessionKey(newSessionKey);

      handleUpdateSettings({
        keyRotationVersion: nextVersion,
        lastRekeyedAt: Date.now(),
      });

      // Update backend key directory API
      fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          keyRotationVersion: nextVersion,
          fingerprint: currentUser.publicKeyFingerprint,
        }),
      }).catch(() => {});

      chatSync.broadcast({
        type: "KEY_ROTATION",
        newVersion: nextVersion,
        senderId: currentUser.id,
      });

      // Professional system notification message
      const sysNotice = "🔒 Security keys refreshed. Conversation remains end-to-end encrypted.";
      const payload = await encryptMessageContent(
        sysNotice,
        newSessionKey,
        "system",
        "all"
      );
      const sysMsg: Message = {
        id: `sys-${Date.now()}`,
        senderId: currentUser.id,
        recipientId: contactUser.id,
        text: sysNotice,
        encryptedPayload: payload,
        timestamp: Date.now(),
        status: "read",
      };
      setMessages((prev) => [...prev, sysMsg]);

      fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          message: {
            id: sysMsg.id,
            senderId: sysMsg.senderId,
            recipientId: sysMsg.recipientId,
            encryptedPayload: sysMsg.encryptedPayload,
            timestamp: sysMsg.timestamp,
            status: sysMsg.status,
          },
        }),
      }).catch(() => {});
    } catch (err) {
      console.error("Failed to rotate key:", err);
    }
  };

  // Emergency Wipe Action
  const handleEmergencyWipe = () => {
    setMessages([]);
    // Wipe on backend API
    fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "wipe" }),
    }).catch(() => {});

    chatSync.broadcast({
      type: "WIPE_ALL",
      senderId: currentUser.id,
    });
    setIsAppLocked(true);
  };

  // Switch identity
  const handleSwitchUser = () => {
    setCurrentUserId((prev) => (prev === "alice" ? "bob" : "alice"));
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

    // Sync reaction to backend API
    fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reaction",
        messageId,
        reaction: { userId: currentUser.id, emoji },
      }),
    }).catch(() => {});
  };

  // 1. Initial hydration check
  if (!isAuthLoaded) {
    return (
      <div className="w-screen h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
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

  // 4. Two-Factor Authentication Gateway (Step 2: Biometrics or 4-digit PIN verification)
  if (isAppLocked || !isSessionUnlocked()) {
    return (
      <AppLockScreen
        correctPin={authUser?.pin || settings.appLockPin || "1234"}
        userName={authUser?.name || authUser?.username || "User"}
        biometricEnabled={authUser?.biometricEnabled ?? true}
        biometricCredentialId={authUser?.biometricCredentialId}
        onUnlock={() => {
          setSessionUnlocked(true);
          setIsAppLocked(false);
        }}
        onPanicBurn={handleEmergencyWipe}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Main App Container - Edge to Edge Professional Interface */}
      <div
        className={`flex-1 flex overflow-hidden relative ${
          isWindowBlurred ? "privacy-blur" : ""
        }`}
      >
        {/* Sidebar: Visible on desktop or when mobileView === 'sidebar' */}
        <div
          className={`h-full ${
            mobileView === "sidebar" ? "w-full flex" : "hidden md:flex"
          }`}
        >
          <ChatSidebar
            currentUser={currentUser}
            contactUser={contactUser}
            contacts={ALL_CONTACTS}
            messages={messages}
            settings={settings}
            selectedChatId={contactUser.id}
            onSelectChat={(id) => {
              setSelectedContactId(id);
              setMobileView("chat");
            }}
            onOpenSecurityCenter={() => {
              if (window.innerWidth < 768) {
                setMobileView("settings");
              } else {
                setIsSecurityCenterOpen(true);
              }
            }}
            onSwitchUser={handleSwitchUser}
            onLockApp={() => {
              setSessionUnlocked(false);
              setIsAppLocked(true);
            }}
            onLogout={handleLogout}
          />
        </div>

        {/* Chat Area: Visible on desktop or when mobileView === 'chat' */}
        <div
          className={`h-full flex-1 ${
            mobileView === "chat" ? "flex" : "hidden md:flex"
          }`}
        >
          <ChatArea
            currentUser={currentUser}
            contactUser={contactUser}
            messages={messages.filter(
              (m) =>
                (m.senderId === contactUser.id && m.recipientId === currentUser.id) ||
                (m.senderId === currentUser.id && m.recipientId === contactUser.id)
            )}
            settings={settings}
            onSendMessage={handleSendMessage}
            onOpenSafetyNumbers={() => setIsSafetyModalOpen(true)}
            onOpenSecurityCenter={() => {
              if (window.innerWidth < 768) {
                setMobileView("settings");
              } else {
                setIsSecurityCenterOpen(true);
              }
            }}
            onBackMobile={() => setMobileView("sidebar")}
            onAddReaction={handleAddReaction}
            onClearChat={() => setMessages([])}
            onTyping={handleTyping}
            isPeerTyping={isPeerTyping}
            onBurnMessage={handleBurnMessage}
            onTogglePinMessage={handleTogglePinMessage}
          />
        </div>

        {/* Mobile Settings Page: Full screen page on mobile */}
        {mobileView === "settings" && (
          <div className="h-full w-full flex md:hidden">
            <MobileSettingsPage
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onRotateKey={handleRotateKey}
              onOpenSafetyNumbers={() => setIsSafetyModalOpen(true)}
              onEmergencyWipe={handleEmergencyWipe}
              onBack={() => setMobileView("chat")}
            />
          </div>
        )}
      </div>

      {/* Privacy Curtain Overlay when Window is Unfocused */}
      {isWindowBlurred && (
        <div
          onClick={() => setIsWindowBlurred(false)}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xl flex flex-col items-center justify-center cursor-pointer select-none text-center p-6 animate-in fade-in duration-150"
        >
          <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center mb-3">
            <EyeOff className="h-8 w-8 text-slate-900" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">
            Privacy Shield Engaged
          </h3>
          <p className="text-xs text-slate-200 max-w-sm mb-4 leading-relaxed">
            Screen is blurred to protect confidential conversation while this window is unfocused.
          </p>
          <span className="px-4 py-2 rounded-lg bg-white text-slate-900 font-semibold text-xs hover:bg-slate-100 transition-colors">
            Click to Restore View
          </span>
        </div>
      )}

      {/* Safety Number Modal (60-digit verification + QR code) */}
      <SafetyNumberModal
        isOpen={isSafetyModalOpen}
        onClose={() => setIsSafetyModalOpen(false)}
        safetyNumber={safetyNumber}
        isVerified={settings.safetyNumberVerified}
        onToggleVerify={(verified) =>
          handleUpdateSettings({ safetyNumberVerified: verified })
        }
        contactName={contactUser.name}
      />

      {/* Owner Security Command Center Modal */}
      <SecurityCommandCenter
        isOpen={isSecurityCenterOpen}
        onClose={() => setIsSecurityCenterOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onRotateKey={handleRotateKey}
        onOpenSafetyNumbers={() => {
          setIsSecurityCenterOpen(false);
          setIsSafetyModalOpen(true);
        }}
        onEmergencyWipe={handleEmergencyWipe}
        currentUserRole={currentUser.role}
      />
    </div>
  );
}
