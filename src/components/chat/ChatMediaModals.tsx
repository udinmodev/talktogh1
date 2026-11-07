"use client";

import React from "react";
import { Message } from "@/types/chat";
import {
  X,
  Flame,
  ImageIcon,
  Download,
  Lock,
} from "lucide-react";
import LinkPreviewCard, { extractUrls, formatMessageWithLinks } from "./LinkPreviewCard";

interface ChatMediaModalsProps {
  previewImage: { url: string; name: string } | null;
  setPreviewImage: (val: { url: string; name: string } | null) => void;
  activeViewOnceMsg: Message | null;
  setActiveViewOnceMsg: (val: Message | null) => void;
  decryptedImages: Record<string, string>;
  onBurnMessage?: (messageId: string) => void;
}

export function ChatMediaModals({
  previewImage,
  setPreviewImage,
  activeViewOnceMsg,
  setActiveViewOnceMsg,
  decryptedImages,
  onBurnMessage,
}: ChatMediaModalsProps) {
  return (
    <>
      {/* Full-Screen Image Lightbox Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col animate-in fade-in duration-150 select-none"
          onClick={() => setPreviewImage(null)}
        >
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
    </>
  );
}
