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

interface SecurityCommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SecuritySettings;
  onUpdateSettings: (newSettings: Partial<SecuritySettings>) => void;
  onRotateKey: () => void;
  onOpenSafetyNumbers: () => void;
  onEmergencyWipe: () => void;
  currentUserRole: "owner" | "contact";
}

export function SecurityCommandCenter({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onRotateKey,
  onOpenSafetyNumbers,
  onEmergencyWipe,
}: SecurityCommandCenterProps) {
  const [activeTab, setActiveTab] = useState<"security" | "customization">("security");
  const [pinInput, setPinInput] = useState(settings.appLockPin || "1234");
  const [showBurnConfirm, setShowBurnConfirm] = useState(false);
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
    { id: "blue", name: "Classic Blue", hex: "#007aff", bgClass: "bg-[#007aff]" },
    { id: "emerald", name: "WeChat Green", hex: "#07c160", bgClass: "bg-[#07c160]" },
    { id: "slate", name: "Stealth Slate", hex: "#0f172a", bgClass: "bg-slate-900" },
    { id: "purple", name: "Royal Purple", hex: "#9333ea", bgClass: "bg-purple-600" },
    { id: "rose", name: "Crimson Rose", hex: "#f43f5e", bgClass: "bg-rose-500" },
    { id: "amber", name: "Warm Amber", hex: "#f59e0b", bgClass: "bg-amber-500" },
  ];

  const wallpapers: { id: ChatWallpaper; label: string; desc: string }[] = [
    { id: "default", label: "Clean Flat", desc: "Minimal light gray" },
    { id: "dots", label: "Subtle Dots", desc: "Fine geometric dots" },
    { id: "grid", label: "Blueprint Grid", desc: "Engineered grid" },
    { id: "warm", label: "Warm Ivory", desc: "Soft parchment tone" },
    { id: "dark", label: "Dark Slate", desc: "High contrast dark" },
  ];

  const fontSizes: { id: FontSize; label: string; preview: string }[] = [
    { id: "small", label: "Small", preview: "12px" },
    { id: "medium", label: "Standard", preview: "14px" },
    { id: "large", label: "Large", preview: "16px" },
  ];

  const bubbleStyles: { id: BubbleStyle; label: string; exampleClass: string }[] = [
    { id: "modern", label: "Modern Curve", exampleClass: "rounded-2xl rounded-br-sm" },
    { id: "pill", label: "Smooth Pill", exampleClass: "rounded-full" },
    { id: "compact", label: "Crisp Flat", exampleClass: "rounded-md" },
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
      title="Settings & Privacy"
      description="Manage end-to-end security, appearance themes, and chat preferences."
      className="max-w-lg"
    >
      <div className="space-y-4 pt-1 text-slate-800">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "security"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Shield className="h-3.5 w-3.5 text-emerald-600" />
            <span>Privacy & Security</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("customization")}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "customization"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Palette className="h-3.5 w-3.5 text-blue-600" />
            <span>Customization</span>
          </button>
        </div>

        {/* TAB 1: PRIVACY & SECURITY */}
        {activeTab === "security" && (
          <div className="space-y-3.5 animate-in fade-in duration-150">
            {/* Encryption Status Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <Shield className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-900">End-to-End Encrypted</span>
                  <span className="text-[10px] font-medium bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full shrink-0">
                    Zero-Knowledge
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  ECDH P-256 + HKDF-SHA256 + AES-256-GCM &bull; Key Epoch #{settings.keyRotationVersion}
                </p>
              </div>
            </div>

            {/* Disappearing Messages */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Timer className="h-4 w-4 text-slate-600" />
                  <span className="font-semibold text-sm text-slate-900">Disappearing Messages</span>
                </div>
                <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-medium">
                  {settings.disappearingTimer === 0 ? "Off" : `${settings.disappearingTimer}s`}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
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
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Inactivity Screen Lock */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Lock className="h-4 w-4 text-slate-600" />
                  <div>
                    <span className="font-semibold text-sm text-slate-900 block">App Passcode Lock</span>
                    <span className="text-xs text-slate-500">Locks automatically upon inactivity</span>
                  </div>
                </div>
                <Switch
                  checked={settings.appLockEnabled}
                  onCheckedChange={(checked) => triggerSavedFeedback({ appLockEnabled: checked })}
                />
              </div>

              {settings.appLockEnabled && (
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="text-xs text-slate-700 font-medium">4-Digit Security PIN</span>
                  <input
                    type="password"
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setPinInput(val);
                      if (val.length === 4) {
                        triggerSavedFeedback({ appLockPin: val });
                      }
                    }}
                    placeholder="1234"
                    className="w-20 px-2 py-1 text-center font-mono font-bold tracking-widest text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800"
                  />
                </div>
              )}
            </div>

            {/* Privacy Curtain */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <EyeOff className="h-4 w-4 text-slate-600" />
                <div>
                  <span className="font-semibold text-sm text-slate-900 block">Privacy Curtain</span>
                  <span className="text-xs text-slate-500">Auto-blurs canvas on tab switch or window minimize</span>
                </div>
              </div>
              <Switch
                checked={settings.privacyCurtain}
                onCheckedChange={(checked) => triggerSavedFeedback({ privacyCurtain: checked })}
              />
            </div>

            {/* Anti-Screenshot Watermark */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Shield className="h-4 w-4 text-slate-600" />
                <div>
                  <span className="font-semibold text-sm text-slate-900 block">Confidential Watermark</span>
                  <span className="text-xs text-slate-500">Overlays identity patterns to prevent leaks</span>
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
                className="flex items-center justify-center gap-1.5 h-9 rounded-xl border-slate-300 text-xs font-semibold cursor-pointer"
              >
                <QrCode className="h-3.5 w-3.5" />
                <span>Safety Numbers</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleRotate}
                disabled={isRotating}
                className="flex items-center justify-center gap-1.5 h-9 rounded-xl border-slate-300 text-xs font-semibold cursor-pointer"
              >
                <RotateCw className={`h-3.5 w-3.5 ${isRotating ? "animate-spin" : ""}`} />
                <span>Rotate Keys</span>
              </Button>
            </div>

            {/* Emergency Wipe */}
            <div className="pt-2 border-t border-slate-200">
              {!showBurnConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowBurnConfirm(true)}
                  className="w-full py-2 px-3 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Flame className="h-3.5 w-3.5" />
                  <span>Emergency Wipe All Messages</span>
                </button>
              ) : (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                  <p className="text-xs text-rose-700 font-semibold text-center">
                    Permanently wipe all messages and keys from this device and server?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBurnConfirm(false)}
                      className="flex-1 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onEmergencyWipe();
                        onClose();
                      }}
                      className="flex-1 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 cursor-pointer"
                    >
                      Confirm Wipe
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CHAT CUSTOMIZATION */}
        {activeTab === "customization" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Theme Accent Color */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                  <Palette className="h-4 w-4 text-slate-600" />
                  Theme Accent Color
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {themeColors.find((c) => c.id === settings.themeColor)?.name}
                </span>
              </div>
              <div className="grid grid-cols-6 gap-2 pt-1">
                {themeColors.map((color) => {
                  const isSelected = (settings.themeColor || "blue") === color.id;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => triggerSavedFeedback({ themeColor: color.id })}
                      className={`h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${color.bgClass} ${
                        isSelected ? "ring-3 ring-offset-2 ring-slate-800 scale-105" : "hover:opacity-90"
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
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2.5">
              <span className="font-semibold text-sm text-slate-900 block">
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
                          ? "bg-slate-900 text-white border-slate-900 ring-2 ring-slate-400"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div className="font-semibold text-xs">{wp.label}</div>
                      <div className={`text-[10px] truncate mt-0.5 ${isSelected ? "text-slate-300" : "text-slate-400"}`}>
                        {wp.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font Size Selector */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-900">Message Font Size</span>
                <span className="text-xs font-mono font-medium text-slate-500">
                  {fontSizes.find((f) => f.id === settings.fontSize)?.preview}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {fontSizes.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => triggerSavedFeedback({ fontSize: f.id })}
                    className={`py-2 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                      (settings.fontSize || "medium") === f.id
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bubble Shape Style */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2.5">
              <span className="font-semibold text-sm text-slate-900 block">Message Bubble Style</span>
              <div className="grid grid-cols-3 gap-2">
                {bubbleStyles.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => triggerSavedFeedback({ bubbleStyle: b.id })}
                    className={`p-2 rounded-xl text-center border text-xs font-medium transition-all cursor-pointer ${
                      (settings.bubbleStyle || "modern") === b.id
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input & Audio Preferences */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
              {/* Press Enter to Send */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CornerDownLeft className="h-4 w-4 text-slate-600" />
                  <div>
                    <span className="font-semibold text-sm text-slate-900 block">Enter Key to Send</span>
                    <span className="text-xs text-slate-500">Pressing Enter immediately sends message</span>
                  </div>
                </div>
                <Switch
                  checked={settings.enterToSend ?? true}
                  onCheckedChange={(checked) => triggerSavedFeedback({ enterToSend: checked })}
                />
              </div>

              {/* Sound Effects */}
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-slate-600" />
                  <div>
                    <span className="font-semibold text-sm text-slate-900 block">Message Audio Cues</span>
                    <span className="text-xs text-slate-500">Subtle sound feedback on send & receive</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => soundManager.playSend()}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 underline cursor-pointer"
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
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCheck className="h-4 w-4 text-slate-600" />
                  <div>
                    <span className="font-semibold text-sm text-slate-900 block">Read Receipts</span>
                    <span className="text-xs text-slate-500">Show double checkmark delivery status</span>
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
        <div className="pt-2 flex items-center justify-between border-t border-slate-200 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500">
            {savedBadge ? (
              <span className="flex items-center gap-1 text-emerald-600 font-semibold animate-in fade-in">
                <Check className="h-3.5 w-3.5" />
                Saved to device
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-slate-400" />
                Auto-saved to local storage
              </span>
            )}
          </div>

          <Button
            onClick={onClose}
            size="sm"
            className="rounded-xl px-4 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
          >
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
