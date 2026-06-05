"use client";

import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Lock, ArrowRight, X } from "lucide-react";

interface SignInNoticeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoinWaitlist: () => void;
}

export default function SignInNoticeModal({
  open,
  onOpenChange,
  onJoinWaitlist,
}: SignInNoticeModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Semi-transparent black backdrop overlay with subtle blur */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-[9998] bg-black/75 backdrop-blur-sm" />
        
        {/* Centered Modal Content Box */}
        <DialogPrimitive.Content
          style={{
            backgroundColor: "#0E1117",
            color: "#E8EAF0",
            borderColor: "#2A3347",
          }}
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-[calc(100%-32px)] max-w-md border rounded-2xl p-6 shadow-2xl overflow-hidden focus:outline-none dark"
        >
          {/* Absolute Glowing Ambient Circles */}
          <div className="absolute -top-20 -right-20 w-44 h-44 rounded-full bg-[#1D9E75]/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-44 h-44 rounded-full bg-[#7F77DD]/10 blur-3xl pointer-events-none" />

          {/* Modal Close Icon */}
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 transition cursor-pointer">
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>

          <div className="flex flex-col items-center text-center space-y-5 py-2">
            {/* Glowing Lock Icon */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-b from-[#1C2333] to-[#0F172A] border border-[#2A3347] flex items-center justify-center shadow-[0_0_15px_rgba(29,158,117,0.15)] relative">
              <div className="absolute inset-0 rounded-full bg-[#1D9E75]/10 animate-ping opacity-60 pointer-events-none" />
              <Lock className="h-5 w-5 text-[#1D9E75]" />
            </div>

            {/* Heading */}
            <div className="space-y-1">
              <DialogPrimitive.Title className="text-lg font-bold text-white tracking-tight">
                Waitlist
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-xs text-[#1D9E75] font-semibold">
                Join our waitlist to get access
              </DialogPrimitive.Description>
            </div>

            {/* Message Content */}
            <p className="text-xs text-[#9BA3B8] leading-relaxed max-w-sm font-medium">
              We are gearing up for our upcoming launch across India! To deliver the best possible learning experience, we are onboarding new members, some of whom can qualify as paid ambassadors.
            </p>

            {/* CTA Button */}
            <button
              onClick={() => {
                onOpenChange(false);
                onJoinWaitlist();
              }}
              className="w-full bg-[#1D9E75] hover:bg-[#1fbd8d] text-neutral-950 font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-[#1D9E75]/15 transition duration-200"
            >
              Join Waitlist Now
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
