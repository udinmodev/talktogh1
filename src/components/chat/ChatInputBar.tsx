"use client";

import React from "react";
import { Message, SecuritySettings } from "@/types/chat";
import {
  Plus,
  Image as ImageIcon,
  Timer,
  Smile,
  Check,
  Send,
  ThumbsUp,
  X,
  Pencil,
  Link2,
  Loader2,
} from "lucide-react";
import { extractUrls } from "./LinkPreviewCard";

export interface AttachedMedia {
  dataUrl: string;
  name: string;
  isGif: boolean;
}

interface ChatInputBarProps {
  attachedMedia: AttachedMedia | null;
  setAttachedMedia: React.Dispatch<React.SetStateAction<AttachedMedia | null>>;
  inputText: string;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  editingMessage: Message | null;
  setEditingMessage: React.Dispatch<React.SetStateAction<Message | null>>;
  showEmojiPicker: boolean;
  setShowEmojiPicker: React.Dispatch<React.SetStateAction<boolean>>;
  showAttachMenu: boolean;
  setShowAttachMenu: React.Dispatch<React.SetStateAction<boolean>>;
  isViewOnceMode: boolean;
  setIsViewOnceMode: React.Dispatch<React.SetStateAction<boolean>>;
  customTimer: number | null;
  setCustomTimer: React.Dispatch<React.SetStateAction<number | null>>;
  showTimerMenu: boolean;
  setShowTimerMenu: React.Dispatch<React.SetStateAction<boolean>>;
  isUploadingImage: boolean;
  settings?: SecuritySettings;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  attachMenuRef: React.RefObject<HTMLDivElement | null>;
  emojis: string[];
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onInputPaste: (e: React.ClipboardEvent) => void;
  onSend: (e?: React.FormEvent) => void;
  onSendThumbsUp: () => void;
  onScrollToBottom: () => void;
}

export function ChatInputBar({
  attachedMedia,
  setAttachedMedia,
  inputText,
  setInputText,
  editingMessage,
  setEditingMessage,
  showEmojiPicker,
  setShowEmojiPicker,
  showAttachMenu,
  setShowAttachMenu,
  isViewOnceMode,
  setIsViewOnceMode,
  customTimer,
  setCustomTimer,
  showTimerMenu,
  setShowTimerMenu,
  isUploadingImage,
  settings,
  imageInputRef,
  attachMenuRef,
  emojis,
  onInputChange,
  onInputPaste,
  onSend,
  onSendThumbsUp,
  onScrollToBottom,
}: ChatInputBarProps) {
  return (
    <>
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

      {/* Clean Input Footer */}
      <footer className="sticky bottom-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white border-t border-[#f0f2f5] z-30 shrink-0">
        <div className="max-w-4xl mx-auto">
          {/* Staged Media Attachment Preview Card */}
          {attachedMedia && (
            <div className="mb-2.5 p-2 bg-[#f0f2f5] border border-[#dce0e5] rounded-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-150 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-black/10 shrink-0 border border-black/10">
                  <img
                    src={attachedMedia.dataUrl}
                    alt={attachedMedia.name}
                    className="w-full h-full object-cover"
                  />
                  {attachedMedia.isGif && (
                    <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[9px] font-bold px-1 rounded">
                      GIF
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <span className="font-semibold text-xs text-[#050505] block truncate max-w-[200px] sm:max-w-xs">
                    {attachedMedia.name}
                  </span>
                  <span className="text-[11px] text-[#65676b] block">
                    Add a caption or press send
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAttachedMedia(null)}
                className="w-7 h-7 rounded-full bg-white hover:bg-neutral-200 text-[#65676b] hover:text-[#050505] flex items-center justify-center cursor-pointer transition-colors shrink-0 shadow-xs mr-1"
                title="Remove attachment"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

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
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#0084ff] hover:bg-[#f0f2f5] transition-colors cursor-pointer shrink-0"
              title="Add attachment"
            >
              <Plus className="h-5 w-5" />
            </button>

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

            <div className="flex-1 flex items-center bg-[#f0f2f5] rounded-full px-3.5 py-1.5 focus-within:ring-2 focus-within:ring-[#0084ff]/20 transition-all">
              <form onSubmit={onSend} onPaste={onInputPaste} className="flex-1 flex items-center mr-1">
                <input
                  type="text"
                  value={inputText}
                  onChange={onInputChange}
                  onPaste={onInputPaste}
                  enterKeyHint="send"
                  autoComplete="off"
                  onFocus={() => {
                    setTimeout(() => onScrollToBottom(), 150);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      if (settings?.enterToSend === false) {
                        e.preventDefault();
                      }
                    }
                  }}
                  placeholder={attachedMedia ? "Add a caption..." : "Aa"}
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
                onClick={() => setIsViewOnceMode((prev) => !prev)}
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

            {/* Send Button or Thumbs Up */}
            {inputText.trim() || attachedMedia ? (
              <button
                type="button"
                onClick={() => onSend()}
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
                onClick={onSendThumbsUp}
                className="w-9 h-9 rounded-full flex items-center justify-center text-[#0084ff] hover:bg-[#f0f2f5] transition-transform active:scale-125 cursor-pointer shrink-0"
                title="Send a Thumbs Up 👍"
              >
                <ThumbsUp className="h-5 w-5 fill-[#0084ff]" />
              </button>
            )}
          </div>
        </div>
      </footer>
    </>
  );
}
