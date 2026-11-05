"use client";

import React, { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SecuritySettings, ThemeColor, ChatWallpaper, FontSize, BubbleStyle } from "@/types/chat";
import {
  Shield,
  Timer,
  Lock,
  EyeOff,
  Flame,
  RotateCw,
  QrCode,
  Palette,
  Volume2,
  CornerDownLeft,
  CheckCheck,
  Check,
  Sparkles,
} from "lucide-react";
import { soundManager } from "@/lib/sound";
import { hashPin, getCurrentAuthUser } from "@/lib/auth";

interface SecurityCommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SecuritySettings;
  onUpdateSettings: (newSettings: Partial<SecuritySettings>) => void;
  onRotateKey: () => void;
  onOpenSafetyNumbers: () => void;
  onEmergencyWipe?: () => void;
  currentUserRole: "owner" | "contact";
}

export function SecurityCommandCenter({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onRotateKey,
  onOpenSafetyNumbers,
}: SecurityCommandCenterProps) {
  const [activeTab, setActiveTab] = useState<"security" | "customization">("security");
  const [pinInput, setPinInput] = useState("");
  const [pinSaved, setPinSaved] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [savedBadge, setSavedBadge] = useState(false);

  const triggerSavedFeedback = (newOpts: Partial<SecuritySettings>) => {
    onUpdateSettings(newOpts);
    setSavedBadge(true);
    setTimeout(() => setSavedBadge(false), 1500);
  };

  const handleRotate = () => {
    setIsRotating(true);
    onRotateKey();
    setTimeout(() => {
      setIsRotating(false);
    }, 600);
  };

  const themeColors: { id: ThemeColor; name: string; hex: string; bgClass: string }[] = [
    { id: "emerald", name: "WhatsApp Emerald", hex: "#00a884", bgClass: "bg-[#00a884]" },
    { id: "blue", name: "Messenger Blue", hex: "#0084ff", bgClass: "bg-[#0084ff]" },
    { id: "slate", name: "Slate Noir", hex: "#111b21", bgClass: "bg-[#111b21]" },
    { id: "purple", name: "Royal Purple", hex: "#7c3aed", bgClass: "bg-[#7c3aed]" },
    { id: "rose", name: "Rose Crimson", hex: "#e11d48", bgClass: "bg-[#e11d48]" },
    { id: "amber", name: "Warm Amber", hex: "#d97706", bgClass: "bg-[#d97706]" },
  ];

  const wallpapers: { id: ChatWallpaper; label: string; desc: string }[] = [
    { id: "default", label: "Classic Warm", desc: "Clean WhatsApp linen" },
    { id: "dots", label: "Fine Dots", desc: "Subtle pattern matrix" },
    { id: "grid", label: "Blueprint Grid", desc: "Light architectural grid" },
    { id: "warm", label: "Cream Pearl", desc: "Gentle ivory warm" },
    { id: "dark", label: "Contrast Dark", desc: "Deep dark canvas" },
  ];

  const fontSizes: { id: FontSize; label: string; preview: string }[] = [
    { id: "small", label: "Small", preview: "12px" },
    { id: "medium", label: "Standard", preview: "14px" },
    { id: "large", label: "Large", preview: "16px" },
  ];

  const bubbleStyles: { id: BubbleStyle; label: string; exampleClass: string }[] = [
    { id: "modern", label: "Modern Curve", exampleClass: "rounded-2xl rounded-br-sm" },
    { id: "pill", label: "Smooth Pill", exampleClass: "rounded-full" },
    { id: "compact", label: "Crisp Flat", exampleClass: "rounded-lg" },
  ];

  const timerOptions = [
    { label: "Off", value: 0 },
    { label: "10s", value: 10 },
    { label: "30s", value: 30 },
    { label: "1m", value: 60 },
    { label: "1h", value: 3600 },
    { label: "24h", value: 86400 },
  ];

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Security & Settings"
      description="Manage Zero-Knowledge wire cryptography and chat preferences."
      className="max-w-lg"
    >
      <div className="space-y-4 pt-1 text-[#050505]">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-[#f0f2f5] rounded-xl border border-[#e4e6eb]">
          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`flex-1 py-1.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "security"
                ? "bg-white text-[#050505] shadow-xs"
                : "text-[#65676b] hover:text-[#050505]"
            }`}
          >
            <Shield className="h-3.5 w-3.5 text-[#0084ff]" />
            <span>Privacy & Security</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("customization")}
            className={`flex-1 py-1.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "customization"
                ? "bg-white text-[#050505] shadow-xs"
                : "text-[#65676b] hover:text-[#050505]"
            }`}
          >
            <Palette className="h-3.5 w-3.5 text-[#0084ff]" />
            <span>Customization</span>
          </button>
        </div>

        {/* TAB 1: PRIVACY & SECURITY */}
        {activeTab === "security" && (
          <div className="space-y-3.5 animate-in fade-in duration-150">
            {/* Encryption Status Card */}
            <div className="p-3.5 rounded-xl bg-[#f0f2f5] border border-[#e4e6eb] flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#e7f3ff] border border-[#0084ff]/20 flex items-center justify-center text-[#0084ff] shrink-0">
                <Shield className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-[#050505]">End-to-End Encrypted</span>
                  <span className="text-[10px] font-medium bg-[#e7f3ff] text-[#0084ff] px-2 py-0.5 rounded-full shrink-0 border border-[#0084ff]/20">
                    Zero-Knowledge
                  </span>
                </div>
                <p className="text-xs text-[#65676b] mt-0.5 truncate">
                  ECDH P-256 + HKDF-SHA256 + AES-256-GCM &bull; Key Epoch #{settings.keyRotationVersion}
                </p>
              </div>
            </div>

            {/* Disappearing Messages */}
            <div className="bg-[#f0f2f5] p-3.5 rounded-xl border border-[#e4e6eb] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Timer className="h-4 w-4 text-[#65676b]" />
                  <span className="font-semibold text-sm text-[#050505]">Disappearing Messages</span>
                </div>
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-medium">
                  {settings.disappearingTimer === 0 ? "Off" : `${settings.disappearingTimer}s`}
                </span>
              </div>
              <p className="text-xs text-[#65676b] leading-relaxed">
                Messages vaporize automatically after expiration with exact event-driven timers.
              </p>
              <div className="grid grid-cols-6 gap-1.5 pt-1">
                {timerOptions.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => triggerSavedFeedback({ disappearingTimer: opt.value })}
                    className={`py-1.5 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                      settings.disappearingTimer === opt.value
                        ? "bg-[#0084ff] text-white border-[#0084ff] font-semibold"
                        : "bg-white text-[#65676b] border-[#e4e6eb] hover:text-[#050505] hover:bg-[#e4e6eb]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Inactivity Screen Lock */}
            <div className="bg-[#f0f2f5] p-3.5 rounded-xl border border-[#e4e6eb] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Lock className="h-4 w-4 text-[#65676b]" />
                  <div>
                    <span className="font-semibold text-sm text-[#050505] block">App Passcode Lock</span>
                    <span className="text-xs text-[#65676b]">Locks automatically upon inactivity</span>
                  </div>
                </div>
                <Switch
                  checked={settings.appLockEnabled}
                  onCheckedChange={(checked) => triggerSavedFeedback({ appLockEnabled: checked })}
                />
              </div>

              {settings.appLockEnabled && (
                <div className="pt-2 border-t border-[#e4e6eb] flex items-center justify-between">
                  <div>
                    <span className="text-xs text-[#65676b] font-medium block">4-Digit Security PIN</span>
                    <span className="text-[11px] text-[#8e8e93]">
                      {pinSaved ? "✓ PIN updated securely" : "Enter 4 digits to set/change"}
                    </span>
                  </div>
                  <input
                    type="password"
                    maxLength={4}
                    value={pinInput}
                    onChange={async (e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setPinInput(val);
                      if (val.length === 4) {
                        const user = getCurrentAuthUser();
                        const username = user?.username || "user";
                        const hashed = await hashPin(val, username);
                        triggerSavedFeedback({ appLockPinHash: hashed });
                        setPinSaved(true);
                        setTimeout(() => {
                          setPinInput("");
                          setPinSaved(false);
                        }, 1500);
                      }
                    }}
                    placeholder="••••"
                    className="w-20 px-2 py-1 text-center font-mono font-bold tracking-widest text-sm bg-white border border-[#e4e6eb] rounded-lg text-[#050505] focus:outline-none focus:border-[#0084ff] focus:ring-1 focus:ring-[#0084ff]"
                  />
                </div>
              )}
            </div>

            {/* Privacy Curtain */}
            <div className="bg-[#f0f2f5] p-3.5 rounded-xl border border-[#e4e6eb] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <EyeOff className="h-4 w-4 text-[#65676b]" />
                <div>
                  <span className="font-semibold text-sm text-[#050505] block">Privacy Curtain</span>
                  <span className="text-xs text-[#65676b]">Auto-blurs canvas on tab switch or minimize</span>
                </div>
              </div>
              <Switch
                checked={settings.privacyCurtain}
                onCheckedChange={(checked) => triggerSavedFeedback({ privacyCurtain: checked })}
              />
            </div>

            {/* Anti-Screenshot Watermark */}
            <div className="bg-[#f0f2f5] p-3.5 rounded-xl border border-[#e4e6eb] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Shield className="h-4 w-4 text-[#65676b]" />
                <div>
                  <span className="font-semibold text-sm text-[#050505] block">Confidential Watermark</span>
                  <span className="text-xs text-[#65676b]">Overlays identity patterns to prevent screen leaks</span>
                </div>
              </div>
              <Switch
                checked={settings.antiScreenshotWatermark}
                onCheckedChange={(checked) => triggerSavedFeedback({ antiScreenshotWatermark: checked })}
              />
            </div>

            {/* Actions: Rotate & Safety Numbers */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenSafetyNumbers}
                className="flex items-center justify-center gap-1.5 h-10 rounded-xl border-[#e4e6eb] bg-white hover:bg-[#e4e6eb] text-xs font-semibold cursor-pointer text-[#0084ff]"
              >
                <QrCode className="h-3.5 w-3.5 text-[#0084ff]" />
                <span>Safety Numbers</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleRotate}
                disabled={isRotating}
                className="flex items-center justify-center gap-1.5 h-10 rounded-xl border-[#e4e6eb] bg-white hover:bg-[#e4e6eb] text-xs font-semibold cursor-pointer text-[#050505]"
              >
                <RotateCw className={`h-3.5 w-3.5 ${isRotating ? "animate-spin" : ""}`} />
                <span>Rotate Keys</span>
              </Button>
            </div>
          </div>
        )}

        {/* TAB 2: CHAT CUSTOMIZATION */}
        {activeTab === "customization" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Theme Accent Color */}
            <div className="bg-[#f8fafc] p-3.5 rounded-xl border border-[#e2e8f0] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-[#111b21] flex items-center gap-2">
                  <Palette className="h-4 w-4 text-[#667781]" />
                  Theme Accent Color
                </span>
                <span className="text-xs font-medium text-[#667781]">
                  {themeColors.find((c) => c.id === settings.themeColor)?.name}
                </span>
              </div>
              <div className="grid grid-cols-6 gap-2 pt-1">
                {themeColors.map((color) => {
                  const isSelected = (settings.themeColor || "emerald") === color.id;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => triggerSavedFeedback({ themeColor: color.id })}
                      className={`h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${color.bgClass} ${
                        isSelected ? "ring-2 ring-[#111b21] scale-105" : "hover:opacity-90"
                      }`}
                      title={color.name}
                    >
                      {isSelected && <Check className="h-4 w-4 text-white stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chat Wallpaper Canvas */}
            <div className="bg-[#f0f2f5] p-3.5 rounded-xl border border-[#e4e6eb] space-y-2.5">
              <span className="font-semibold text-sm text-[#050505] block">
                Chat Canvas Wallpaper
              </span>
              <div className="grid grid-cols-3 gap-2">
                {wallpapers.map((wp) => {
                  const isSelected = (settings.chatWallpaper || "default") === wp.id;
                  return (
                    <button
                      key={wp.id}
                      type="button"
                      onClick={() => triggerSavedFeedback({ chatWallpaper: wp.id })}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-white text-[#050505] border-[#0084ff] shadow-xs ring-1 ring-[#0084ff]"
                          : "bg-white text-[#65676b] border-[#e4e6eb] hover:text-[#050505] hover:bg-[#e4e6eb]"
                      }`}
                    >
                      <div className="font-semibold text-xs text-[#050505]">{wp.label}</div>
                      <div className="text-[10px] truncate mt-0.5 text-[#65676b]">
                        {wp.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font Size Selector */}
            <div className="bg-[#f0f2f5] p-3.5 rounded-xl border border-[#e4e6eb] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-[#050505]">Message Font Size</span>
                <span className="text-xs font-mono font-medium text-[#65676b]">
                  {fontSizes.find((f) => f.id === settings.fontSize)?.preview}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {fontSizes.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => triggerSavedFeedback({ fontSize: f.id })}
                    className={`py-2 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                      (settings.fontSize || "medium") === f.id
                        ? "bg-[#0084ff] text-white border-[#0084ff] font-semibold"
                        : "bg-white text-[#65676b] border-[#e4e6eb] hover:text-[#050505] hover:bg-[#e4e6eb]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bubble Shape Style */}
            <div className="bg-[#f0f2f5] p-3.5 rounded-xl border border-[#e4e6eb] space-y-2.5">
              <span className="font-semibold text-sm text-[#050505] block">Message Bubble Style</span>
              <div className="grid grid-cols-3 gap-2">
                {bubbleStyles.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => triggerSavedFeedback({ bubbleStyle: b.id })}
                    className={`p-2.5 rounded-xl text-center border text-xs font-medium transition-all cursor-pointer ${
                      (settings.bubbleStyle || "modern") === b.id
                        ? "bg-[#0084ff] text-white border-[#0084ff] font-semibold"
                        : "bg-white text-[#65676b] border-[#e4e6eb] hover:text-[#050505] hover:bg-[#e4e6eb]"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input & Audio Preferences */}
            <div className="bg-[#f0f2f5] p-3.5 rounded-xl border border-[#e4e6eb] space-y-3">
              {/* Press Enter to Send */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CornerDownLeft className="h-4 w-4 text-[#65676b]" />
                  <div>
                    <span className="font-semibold text-sm text-[#050505] block">Enter Key to Send</span>
                    <span className="text-xs text-[#65676b]">Pressing Enter immediately sends message</span>
                  </div>
                </div>
                <Switch
                  checked={settings.enterToSend ?? true}
                  onCheckedChange={(checked) => triggerSavedFeedback({ enterToSend: checked })}
                />
              </div>

              {/* Sound Effects */}
              <div className="pt-2 border-t border-[#e4e6eb] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-[#65676b]" />
                  <div>
                    <span className="font-semibold text-sm text-[#050505] block">Message Audio Cues</span>
                    <span className="text-xs text-[#65676b]">Subtle sound feedback on send & receive</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => soundManager.playSend()}
                    className="text-[11px] font-semibold text-[#0084ff] hover:underline cursor-pointer"
                  >
                    Test
                  </button>
                  <Switch
                    checked={settings.soundEffects ?? true}
                    onCheckedChange={(checked) => triggerSavedFeedback({ soundEffects: checked })}
                  />
                </div>
              </div>

              {/* Read Receipts */}
              <div className="pt-2 border-t border-[#e4e6eb] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCheck className="h-4 w-4 text-[#65676b]" />
                  <div>
                    <span className="font-semibold text-sm text-[#050505] block">Read Receipts</span>
                    <span className="text-xs text-[#65676b]">Show double checkmark delivery status</span>
                  </div>
                </div>
                <Switch
                  checked={settings.readReceipts ?? true}
                  onCheckedChange={(checked) => triggerSavedFeedback({ readReceipts: checked })}
                />
              </div>
            </div>
          </div>
        )}

        {/* Saved Status Indicator Banner */}
        <div className="pt-2 flex items-center justify-between border-t border-[#e4e6eb] text-xs">
          <div className="flex items-center gap-1.5 text-[#65676b]">
            {savedBadge ? (
              <span className="flex items-center gap-1 text-[#0084ff] font-semibold animate-in fade-in">
                <Check className="h-3.5 w-3.5" />
                Saved to device
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-[#8a8d91]" />
                Auto-saved to local storage
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="rounded-xl px-5 py-2 text-xs font-semibold bg-[#0084ff] text-white hover:bg-[#0073e6] transition-all cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </Dialog>
  );
}
