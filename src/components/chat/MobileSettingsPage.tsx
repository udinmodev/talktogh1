"use client";

import React, { useState } from "react";
import { SecuritySettings, ThemeColor, ChatWallpaper, FontSize, BubbleStyle } from "@/types/chat";
import {
  ArrowLeft,
  ShieldCheck,
  Timer,
  Lock,
  EyeOff,
  Flame,
  KeyRound,
  Shield,
  Palette,
  Volume2,
  CornerDownLeft,
  CheckCheck,
  Check,
  Sparkles,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { soundManager } from "@/lib/sound";
import { hashPin, getCurrentAuthUser } from "@/lib/auth";

interface MobileSettingsPageProps {
  settings: SecuritySettings;
  onUpdateSettings: (newSettings: Partial<SecuritySettings>) => void;
  onRotateKey: () => void;
  onOpenSafetyNumbers?: () => void;
  onEmergencyWipe?: () => void;
  onBack: () => void;
}

export function MobileSettingsPage({
  settings,
  onUpdateSettings,
  onBack,
}: MobileSettingsPageProps) {
  const [activeTab, setActiveTab] = useState<"security" | "customization">("security");
  const [pinInput, setPinInput] = useState("");
  const [pinSaved, setPinSaved] = useState(false);
  const [savedBadge, setSavedBadge] = useState(false);

  const triggerUpdate = (newOpts: Partial<SecuritySettings>) => {
    onUpdateSettings(newOpts);
    setSavedBadge(true);
    setTimeout(() => setSavedBadge(false), 1200);
  };

  const presets = [
    { label: "Off", value: 0 },
    { label: "30s", value: 30 },
    { label: "5m", value: 300 },
    { label: "24h", value: 86400 },
  ];

  const themeColors: { id: ThemeColor; name: string; bgClass: string }[] = [
    { id: "blue", name: "YouTube Blue", bgClass: "bg-[#3ea6ff]" },
    { id: "emerald", name: "Signal Green", bgClass: "bg-[#07c160]" },
    { id: "slate", name: "YouTube Matte", bgClass: "bg-[#272727]" },
    { id: "purple", name: "Neon Purple", bgClass: "bg-purple-600" },
    { id: "rose", name: "YouTube Red", bgClass: "bg-[#ff0000]" },
    { id: "amber", name: "Warm Amber", bgClass: "bg-amber-500" },
  ];

  const wallpapers: { id: ChatWallpaper; label: string }[] = [
    { id: "default", label: "YouTube Dark" },
    { id: "dots", label: "Dots" },
    { id: "grid", label: "Grid" },
    { id: "warm", label: "Warm Noir" },
    { id: "dark", label: "Pitch Black" },
  ];

  const fontSizes: { id: FontSize; label: string; px: string }[] = [
    { id: "small", label: "Small", px: "12px" },
    { id: "medium", label: "Standard", px: "14px" },
    { id: "large", label: "Large", px: "16px" },
  ];

  const bubbleStyles: { id: BubbleStyle; label: string }[] = [
    { id: "modern", label: "Modern" },
    { id: "pill", label: "Pill" },
    { id: "compact", label: "Compact" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#f0f2f5] flex flex-col font-sans select-none antialiased text-[#050505]">
      {/* Light Navigation Bar */}
      <header className="h-14 px-4 bg-white flex items-center justify-between border-b border-[#f0f2f5] shrink-0 z-20">
        <button
          onClick={onBack}
          className="flex items-center gap-1 -ml-1 text-[#0084ff] hover:opacity-80 transition-opacity cursor-pointer font-medium text-[15px]"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Chats</span>
        </button>
        <span className="font-semibold text-[16px] text-[#050505]">
          Settings
        </span>
        <button
          onClick={onBack}
          className="text-[15px] font-semibold text-[#0084ff] hover:opacity-80 transition-opacity cursor-pointer"
        >
          Done
        </button>
      </header>

      {/* Segmented Top Control */}
      <div className="p-3 bg-[#f0f2f5] border-b border-[#e4e6eb]">
        <div className="flex bg-white border border-[#e4e6eb] p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "security"
                ? "bg-[#0084ff] text-white shadow-xs"
                : "text-[#65676b] hover:text-[#050505]"
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>Security</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("customization")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "customization"
                ? "bg-[#0084ff] text-white shadow-xs"
                : "text-[#65676b] hover:text-[#050505]"
            }`}
          >
            <Palette className="h-3.5 w-3.5" />
            <span>Customization</span>
          </button>
        </div>
      </div>

      {/* Settings Scrollable Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#f0f2f5] bg-white pb-16">
        {activeTab === "security" && (
          <>
            {/* E2EE Info Block */}
            <div className="px-4 py-4 bg-[#f0f2f5]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#e7f3ff] border border-[#0084ff]/20 flex items-center justify-center text-[#0084ff]">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#050505]">
                    ECDH P-256 + AES-GCM
                  </div>
                  <div className="text-xs text-[#65676b]">
                    Zero-Knowledge encryption active
                  </div>
                </div>
              </div>
            </div>

            {/* Disappearing Timer Preset Chips */}
            <div className="px-4 py-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-[#65676b]" />
                  <span className="text-[15px] font-medium text-[#050505]">
                    Disappearing Messages
                  </span>
                </div>
                <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium border border-amber-200">
                  {settings.disappearingTimer === 0 ? "Off" : `${settings.disappearingTimer}s`}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => triggerUpdate({ disappearingTimer: preset.value })}
                    className={`py-2 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                      settings.disappearingTimer === preset.value
                        ? "bg-[#0084ff] text-white border-[#0084ff] font-semibold"
                        : "bg-white text-[#65676b] border-[#e4e6eb]"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Inactivity Screen Lock Toggle */}
            <div className="px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-[#65676b]" />
                  <div>
                    <div className="text-[15px] font-medium text-[#050505]">
                      App Lock
                    </div>
                    <div className="text-xs text-[#65676b]">
                      Lock after 1 minute of inactivity
                    </div>
                  </div>
                </div>
                <Switch
                  checked={settings.appLockEnabled}
                  onCheckedChange={(checked) => triggerUpdate({ appLockEnabled: checked })}
                />
              </div>

              {settings.appLockEnabled && (
                <div className="pt-2 flex items-center justify-between border-t border-[#f0f2f5]">
                  <div>
                    <span className="text-xs text-[#65676b] block">Passcode PIN</span>
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
                        triggerUpdate({ appLockPinHash: hashed });
                        setPinSaved(true);
                        setTimeout(() => {
                          setPinInput("");
                          setPinSaved(false);
                        }, 1500);
                      }
                    }}
                    className="w-20 px-2 py-1 text-center font-mono font-bold tracking-widest text-sm bg-white border border-[#e4e6eb] rounded-lg text-[#050505] focus:outline-none focus:border-[#0084ff]"
                    placeholder="••••"
                  />
                </div>
              )}
            </div>

            {/* Privacy Curtain */}
            <div className="px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <EyeOff className="h-4 w-4 text-[#65676b]" />
                <div>
                  <div className="text-[15px] font-medium text-[#050505]">
                    Privacy Curtain
                  </div>
                  <div className="text-xs text-[#65676b]">
                    Blur when switching apps
                  </div>
                </div>
              </div>
              <Switch
                checked={settings.privacyCurtain}
                onCheckedChange={(checked) => triggerUpdate({ privacyCurtain: checked })}
              />
            </div>
          </>
        )}

        {activeTab === "customization" && (
          <>
            {/* Customization: Theme Colors */}
            <div className="px-4 py-4 space-y-2.5">
              <div className="text-[15px] font-medium text-[#050505]">
                Accent Color
              </div>
              <div className="grid grid-cols-6 gap-2">
                {themeColors.map((color) => {
                  const isSelected = (settings.themeColor || "emerald") === color.id;
                  return (
                    <button
                      key={color.id}
                      onClick={() => triggerUpdate({ themeColor: color.id })}
                      className={`h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer ${color.bgClass} ${
                        isSelected ? "ring-2 ring-[#050505] scale-105" : ""
                      }`}
                      title={color.name}
                    >
                      {isSelected && <Check className="h-4 w-4 text-white stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Customization: Chat Wallpaper */}
            <div className="px-4 py-4 space-y-2.5">
              <div className="text-[15px] font-medium text-[#050505]">
                Chat Wallpaper
              </div>
              <div className="grid grid-cols-3 gap-2">
                {wallpapers.map((wp) => {
                  const isSelected = (settings.chatWallpaper || "default") === wp.id;
                  return (
                    <button
                      key={wp.id}
                      onClick={() => triggerUpdate({ chatWallpaper: wp.id })}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? "bg-white text-[#050505] border-[#0084ff] ring-1 ring-[#0084ff] font-semibold"
                          : "bg-white text-[#65676b] border-[#e4e6eb]"
                      }`}
                    >
                      {wp.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Customization: Font Size */}
            <div className="px-4 py-4 space-y-2.5">
              <div className="text-[15px] font-medium text-[#050505]">
                Font Size
              </div>
              <div className="grid grid-cols-3 gap-2">
                {fontSizes.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => triggerUpdate({ fontSize: f.id })}
                    className={`py-2 rounded-lg border text-xs font-medium text-center transition-all cursor-pointer ${
                      (settings.fontSize || "medium") === f.id
                        ? "bg-[#0084ff] text-white border-[#0084ff] font-semibold"
                        : "bg-white text-[#65676b] border-[#e4e6eb]"
                    }`}
                  >
                    {f.label} ({f.px})
                  </button>
                ))}
              </div>
            </div>

            {/* Customization: Bubble Shape */}
            <div className="px-4 py-4 space-y-2.5">
              <div className="text-[15px] font-medium text-[#050505]">
                Bubble Style
              </div>
              <div className="grid grid-cols-3 gap-2">
                {bubbleStyles.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => triggerUpdate({ bubbleStyle: b.id })}
                    className={`py-2 rounded-xl border text-xs font-medium text-center transition-all cursor-pointer ${
                      (settings.bubbleStyle || "modern") === b.id
                        ? "bg-[#0084ff] text-white border-[#0084ff] font-semibold"
                        : "bg-white text-[#65676b] border-[#e4e6eb]"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Customization: Sound Effects */}
            <div className="px-4 py-4 flex items-center justify-between">
              <div>
                <div className="text-[15px] font-medium text-[#050505]">
                  Message Audio Cues
                </div>
                <div className="text-xs text-[#65676b] mt-0.5">
                  Play sounds on message send
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => soundManager.playSend()}
                  className="text-xs font-semibold text-[#0084ff] underline cursor-pointer"
                >
                  Test
                </button>
                <Switch
                  checked={settings.soundEffects ?? true}
                  onCheckedChange={(checked) => triggerUpdate({ soundEffects: checked })}
                />
              </div>
            </div>

            {/* Customization: Read Receipts */}
            <div className="px-4 py-4 flex items-center justify-between">
              <div>
                <div className="text-[15px] font-medium text-[#050505]">
                  Read Receipts
                </div>
                <div className="text-xs text-[#65676b] mt-0.5">
                  Show delivery checkmarks
                </div>
              </div>
              <Switch
                checked={settings.readReceipts ?? true}
                onCheckedChange={(checked) => triggerUpdate({ readReceipts: checked })}
              />
            </div>
          </>
        )}
      </div>

      {/* Save Notification Footer */}
      <footer className="h-10 px-4 bg-[#f0f2f5] border-t border-[#f0f2f5] flex items-center justify-between text-xs text-[#65676b] shrink-0">
        <span className="flex items-center gap-1.5">
          {savedBadge ? (
            <span className="text-[#0084ff] font-semibold flex items-center gap-1">
              <Check className="h-3 w-3" />
              Settings saved!
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-[#8a8d91]" />
              Auto-saved to device
            </span>
          )}
        </span>
        <span className="text-[11px] font-mono text-[#8a8d91]">E2EE v2.0</span>
      </footer>
    </div>
  );
}
