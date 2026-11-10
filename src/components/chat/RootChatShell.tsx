"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import { User } from "@/types/chat";
import { chatSync } from "@/lib/broadcast";
import { secureSocket } from "@/lib/socket";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { SafetyNumberModal } from "@/components/chat/SafetyNumberModal";
import { SecurityCommandCenter } from "@/components/chat/SecurityCommandCenter";
import { MobileSettingsPage } from "@/components/chat/MobileSettingsPage";
import { AppLockScreen } from "@/components/chat/AppLockScreen";
import { AuthLoginPage } from "@/components/auth/AuthLoginPage";
import { SecuritySetupScreen } from "@/components/auth/SecuritySetupScreen";
import { isSessionUnlocked, setSessionUnlocked } from "@/lib/auth";
import { WifiOff, X } from "lucide-react";
import { ChatContext, ChatContextType } from "./ChatContext";
import { useChatSettings } from "@/hooks/useChatSettings";
import { useChatAuth } from "@/hooks/useChatAuth";
import { useChatMessages } from "@/hooks/useChatMessages";
import { registerTalkTogetherPush } from "@/lib/firebase-client";

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
  const decodedRawId = rawId ? decodeURIComponent(rawId).split("@")[0].toLowerCase() : "";
  const routeContactId =
    decodedRawId &&
    decodedRawId !== "favicon.ico" &&
    !decodedRawId.startsWith("api") &&
    decodedRawId !== "none"
      ? decodedRawId
      : "";

  const [selectedContactId, setSelectedContactId] = useState<string>(routeContactId);
  const [mobileView, setMobileView] = useState<"sidebar" | "chat" | "settings">(
    routeContactId ? "chat" : "sidebar"
  );

  // Synchronize state when route changes (zero flicker, continuous layout)
  useEffect(() => {
    if (routeContactId) {
      setSelectedContactId(routeContactId);
      setMobileView("chat");
    } else {
      setSelectedContactId("");
      setMobileView("sidebar");
    }
  }, [routeContactId]);

  // Network & Offline Detection
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [networkError, setNetworkError] = useState<string | null>(null);

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

  // Track visual viewport on mobile (handles keyboard open/close without pushing header off-screen)
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const updateHeight = () => {
      const vh = window.visualViewport?.height;
      if (vh) {
        document.documentElement.style.setProperty("--visual-viewport-height", `${vh}px`);
      }
    };

    updateHeight();
    const vv = window.visualViewport;
    vv.addEventListener("resize", updateHeight);
    vv.addEventListener("scroll", updateHeight);

    return () => {
      vv.removeEventListener("resize", updateHeight);
      vv.removeEventListener("scroll", updateHeight);
    };
  }, []);

  // Modals state
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [isSecurityCenterOpen, setIsSecurityCenterOpen] = useState(false);

  // Derive active IDs
  const rawActiveChatId = (selectedContactId || routeContactId || "").split("@")[0].toLowerCase();

  // 1. Hook: Settings & Cloud Sync
  // Temporary current ID resolver for settings hook
  const [initialUser] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const raw = sessionStorage.getItem("wechat_current_auth_user_v2") || localStorage.getItem("wechat_current_auth_user_v2");
      return raw ? JSON.parse(raw)?.username || "" : "";
    } catch {
      return "";
    }
  });

  const { settings, handleUpdateSettings, isWindowBlurred } = useChatSettings(initialUser);

  // 2. Hook: Auth & Lock State
  const {
    authUser,
    isAuthLoaded,
    cleanCurrentId,
    isAppLocked,
    setIsAppLocked,
    handleLoginSuccess,
    handleSecuritySetupComplete,
    handleLogout,
  } = useChatAuth({
    settings,
    onSettingsUpdate: handleUpdateSettings,
    onClearSelectedContact: () => setSelectedContactId(""),
  });

  const activeChatId = (
    rawActiveChatId && rawActiveChatId !== "none" && rawActiveChatId !== cleanCurrentId
      ? rawActiveChatId
      : ""
  ).split("@")[0].toLowerCase();

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

  // 3. Hook: Messages, Contacts, and Cryptographic Operations
  // Dynamic contactUser placeholder will be refined with contacts from hook
  const [contactsRef, setContactsRef] = useState<User[]>([]);

  const contactUser: User =
    (activeChatId && activeChatId !== "none" ? contactsRef.find((c) => c.id === activeChatId) : null) || {
      id: activeChatId || "none",
      name: activeChatId && activeChatId !== "none" ? activeChatId : "Select a Contact",
      role: "contact",
      avatar: activeChatId && activeChatId !== "none"
        ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(activeChatId)}`
        : "https://api.dicebear.com/7.x/initials/svg?seed=None",
      phone: activeChatId && activeChatId !== "none" ? `@${activeChatId}` : "",
      about: activeChatId && activeChatId !== "none" ? "Registered confidential identity." : "No user selected.",
      publicKeyFingerprint: "7EFE2C6DCC10DA73",
      isOnline: false,
    };

  const {
    contacts,
    isLoadingContacts,
    sessionKey,
    safetyNumber,
    messages,
    setMessages,
    activeMessages,
    isLoadingMessages,
    hasMoreMessages,
    isLoadingMoreMessages,
    loadMoreMessages,
    isPeerTyping,
    handleSendMessage,
    handleTogglePinMessage,
    handleBurnMessage,
    handleTyping,
    handleAddReaction,
    handleDeleteMessage,
    handleEditMessage,
  } = useChatMessages({
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
  });

  const pushRegisteredRef = useRef(false);
  const canRegisterPush = Boolean(
    isAuthLoaded && authUser && !isAppLocked && authUser.isSecuritySetupComplete && cleanCurrentId
  );

  const tryRegisterPush = useCallback(() => {
    if (!canRegisterPush) return;
    void registerTalkTogetherPush(cleanCurrentId).then((result) => {
      if (result.status === "registered") {
        pushRegisteredRef.current = true;
      } else {
        console.warn("[Push] Registration not completed:", result.reason || result.status);
      }
    });
  }, [canRegisterPush, cleanCurrentId]);

  useEffect(() => {
    pushRegisteredRef.current = false;
    tryRegisterPush();
  }, [tryRegisterPush]);

  useEffect(() => {
    if (!canRegisterPush) return;

    const retryIfNeeded = () => {
      if (!pushRegisteredRef.current) tryRegisterPush();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") retryIfNeeded();
    };

    window.addEventListener("online", retryIfNeeded);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("online", retryIfNeeded);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [canRegisterPush, tryRegisterPush]);

  useEffect(() => {
    setContactsRef(contacts);
  }, [contacts]);

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
    hasMoreMessages,
    isLoadingMoreMessages,
    loadMoreMessages,
    isPeerTyping,
    isOnline,
    networkError,
    sendMessage: handleSendMessage,
    burnMessage: handleBurnMessage,
    deleteMessage: handleDeleteMessage,
    editMessage: handleEditMessage,
    togglePinMessage: handleTogglePinMessage,
    addReaction: handleAddReaction,
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
      setSessionUnlocked(false, cleanCurrentId);
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
  if (isAppLocked || !isSessionUnlocked(cleanCurrentId)) {
    return (
      <AppLockScreen
        pinHash={authUser?.pinHash || settings.appLockPinHash || ""}
        username={cleanCurrentId}
        userName={authUser?.name || authUser?.username || "User"}
        biometricEnabled={authUser?.biometricEnabled ?? true}
        biometricCredentialId={authUser?.biometricCredentialId}
        onUnlock={() => {
          setSessionUnlocked(true, cleanCurrentId);
          setIsAppLocked(false);
        }}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <ChatContext.Provider value={contextValue}>
      <div
        className="fixed inset-0 w-full h-full overflow-hidden bg-white flex flex-col font-sans text-[#050505]"
        style={{
          height: "var(--visual-viewport-height, 100dvh)",
          maxHeight: "var(--visual-viewport-height, 100dvh)",
        }}
      >
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
          className={`flex-1 min-h-0 flex overflow-hidden relative ${
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
              selectedChatId={selectedContactId || routeContactId || ""}
              isLoading={isLoadingContacts || (isLoadingMessages && messages.length === 0)}
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
                setSessionUnlocked(false, cleanCurrentId);
                setIsAppLocked(true);
              }}
              onLogout={handleLogout}
            />
          </div>

          {/* Active Chat Content / Home Slot */}
          <div
            className={`h-full flex-1 min-h-0 min-w-0 flex-col overflow-hidden ${
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
