"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Copy, Download, Loader2, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  canCopyInstaCuePng,
  copyInstaCuePngToClipboard,
  downloadInstaCuePng,
  shareInstaCuePngViaWhatsAppWeb,
} from "@/lib/instacue/shareInstaCueImage";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-rendered share PNG (null while generating). */
  blob: Blob | null;
  previewUrl: string | null;
  loading: boolean;
  error: string | null;
  filename: string;
  onToast: (opts: { title: string; description?: string; variant?: "destructive" }) => void;
};

/**
 * Desktop share sheet — same pattern big products use when OS share is weak:
 * preview + destination tiles (WhatsApp / Download / Copy).
 */
export default function InstaCueShareSheet({
  open,
  onOpenChange,
  blob,
  previewUrl,
  loading,
  error,
  filename,
  onToast,
}: Props) {
  const [busy, setBusy] = useState<null | "whatsapp" | "download" | "copy">(null);
  const copyOk = canCopyInstaCuePng();

  useEffect(() => {
    if (!open) setBusy(null);
  }, [open]);

  const run = async (action: "whatsapp" | "download" | "copy") => {
    if (!blob || loading || busy) return;
    setBusy(action);
    try {
      switch (action) {
        case "whatsapp":
          shareInstaCuePngViaWhatsAppWeb(blob, { filename });
          onToast({
            title: "Opening WhatsApp",
            description: "PNG saved to Downloads — attach it with 📎 in the chat.",
          });
          onOpenChange(false);
          break;
        case "download":
          downloadInstaCuePng(blob, filename);
          onToast({
            title: "PNG downloaded",
            description: "Share the file anywhere — WhatsApp, Telegram, email.",
          });
          onOpenChange(false);
          break;
        case "copy":
          await copyInstaCuePngToClipboard(blob);
          onToast({
            title: "Image copied",
            description: "Paste into WhatsApp Web, Docs, or any chat (Ctrl+V).",
          });
          onOpenChange(false);
          break;
        default: {
          const _exhaustive: never = action;
          return _exhaustive;
        }
      }
    } catch (err) {
      onToast({
        variant: "destructive",
        title: "Share failed",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[91] w-[min(420px,calc(100vw-1.5rem))] gap-0 overflow-hidden border-border/60 bg-[#12161e] p-0 text-foreground shadow-2xl sm:rounded-2xl"
        overlayClassName="z-[90] bg-black/70 backdrop-blur-[2px]"
      >
        <DialogHeader className="border-b border-white/[0.08] px-5 py-4 pr-12 text-left">
          <DialogTitle className="text-[15px] font-semibold tracking-tight text-white">
            Share InstaCue
          </DialogTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Send this card to your study group
          </p>
        </DialogHeader>

        <div className="px-5 pt-4">
          <div className="relative mx-auto aspect-[9/16] w-full max-w-[200px] overflow-hidden rounded-xl border border-white/10 bg-[#0a0e14] shadow-lg">
            {loading || !previewUrl ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                <span className="text-[11px] font-medium">Preparing image…</span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="InstaCue share preview"
                className="h-full w-full object-contain bg-[#05070c]"
              />
            )}
          </div>
          {error ? (
            <p className="mt-3 text-center text-xs text-destructive">{error}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2 px-5 py-5">
          <ShareTile
            label="WhatsApp"
            sub="Web / app"
            disabled={!blob || loading || busy != null}
            busy={busy === "whatsapp"}
            onClick={() => void run("whatsapp")}
            iconClass="bg-[#25D366]/15 text-[#25D366] ring-[#25D366]/30"
            icon={<MessageCircle className="h-5 w-5" />}
          />
          <ShareTile
            label="Download"
            sub="PNG file"
            disabled={!blob || loading || busy != null}
            busy={busy === "download"}
            onClick={() => void run("download")}
            iconClass="bg-sky-500/15 text-sky-300 ring-sky-500/30"
            icon={<Download className="h-5 w-5" />}
          />
          <ShareTile
            label="Copy"
            sub={copyOk ? "Clipboard" : "N/A"}
            disabled={!blob || loading || busy != null || !copyOk}
            busy={busy === "copy"}
            onClick={() => void run("copy")}
            iconClass="bg-violet-500/15 text-violet-300 ring-violet-500/30"
            icon={<Copy className="h-5 w-5" />}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShareTile({
  label,
  sub,
  icon,
  iconClass,
  disabled,
  busy,
  onClick,
}: {
  label: string;
  sub: string;
  icon: ReactNode;
  iconClass: string;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2 py-3 transition",
        "hover:border-white/20 hover:bg-white/[0.06]",
        "disabled:pointer-events-none disabled:opacity-40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full ring-1",
          iconClass
        )}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      </span>
      <span className="text-center">
        <span className="block text-xs font-semibold text-white">{label}</span>
        <span className="block text-[10px] text-muted-foreground">{sub}</span>
      </span>
    </button>
  );
}
