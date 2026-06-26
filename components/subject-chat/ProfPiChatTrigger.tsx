"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot } from "lucide-react";
import { PROF_PI_CHAT } from "@/components/subject-chat/profPiChatTheme";
import ProfPiBrandName from "@/components/subject-chat/ProfPiBrandName";

interface ProfPiChatTriggerProps {
  position: { x: number; y: number };
  showHideMenu: boolean;
  onHideForMinutes: (minutes: number) => void;
  onTriggerClick: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export default function ProfPiChatTrigger({
  position,
  showHideMenu,
  onHideForMinutes,
  onTriggerClick,
  onPointerDown,
  onContextMenu,
}: ProfPiChatTriggerProps) {
  return (
    <div
      className="fixed z-[9999] flex flex-col items-start gap-3 pointer-events-auto select-none"
      style={{
        left: position.x,
        top: position.y,
        touchAction: "none",
      }}
      onContextMenu={onContextMenu}
    >
      <AnimatePresence>
        {showHideMenu && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            className="rounded-xl border border-[#2A3347] bg-[#161B25] p-2 w-44 shadow-xl"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] font-semibold text-[#5C6480] px-2 pb-1">Hide AI helper</p>
            {[2, 5, 10].map((min) => (
              <button
                key={min}
                type="button"
                className="w-full text-left text-sm px-2.5 py-1.5 rounded-lg hover:bg-[#1C2333] text-[#E8EAF0]"
                onClick={() => onHideForMinutes(min)}
              >
                Hide for {min} min
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="group flex flex-row items-center cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
      >
        <motion.div
          role="button"
          tabIndex={0}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.06 }}
          onClick={onTriggerClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onTriggerClick();
            }
          }}
          className="relative flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full outline-none touch-none"
          aria-label="Open Prof Pi chat — drag to move"
        >
          <motion.div
            animate={{ scale: [1, 1.25, 1], opacity: [0.25, 0, 0.25] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-[#534AB7] to-[#7F77DD]"
          />
          <div
            className="pointer-events-none relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#534AB7] to-[#7F77DD]"
            style={{
              boxShadow:
                "0 0 0 4px rgba(127,119,221,0.2), 0 4px 20px rgba(83,74,183,0.5)",
            }}
          >
            <Bot className="h-[26px] w-[26px] text-white" strokeWidth={1.75} aria-hidden />
            <div
              className="absolute -bottom-0.5 -right-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 text-[10px] font-bold text-white"
              style={{
                backgroundColor: PROF_PI_CHAT.teal,
                borderColor: PROF_PI_CHAT.bg,
              }}
              aria-hidden
            >
              π
            </div>
          </div>
        </motion.div>

        {/* Hover label — visual only; does not block drag */}
        <div className="pointer-events-none hidden -ml-2.5 origin-left scale-95 flex-col gap-0.5 rounded-[20px] border border-[#2A3347] bg-[#161B25] py-2 pl-5 pr-4 opacity-0 shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 lg:flex">
          <ProfPiBrandName piTone="purple" profClassName="text-[#E8EAF0]" />
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#1D9E75] animate-pulse"
              aria-hidden
            />
            <span className="rounded-full bg-white px-2.5 py-0.5 text-[13px] font-semibold tracking-tight text-[#161B25] shadow-sm">
              Any doubts? Ask me
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
