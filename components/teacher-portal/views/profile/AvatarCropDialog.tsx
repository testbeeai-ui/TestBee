"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import type { Area } from "react-easy-crop";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { canvasCropToJpegBlob } from "@/lib/profile/avatarCropCanvas";

type AvatarCropDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Object URL from URL.createObjectURL(file) */
  imageSrc: string | null;
  onApply: (file: File) => Promise<void>;
  /** Called when dialog closes so parent can revoke object URL */
  onDiscard: () => void;
};

export function AvatarCropDialog({
  open,
  onOpenChange,
  imageSrc,
  onApply,
  onDiscard,
}: AvatarCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (open && imageSrc) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [open, imageSrc]);

  const onCropComplete = useCallback((_area: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleClose = (next: boolean) => {
    if (!next) {
      onDiscard();
    }
    onOpenChange(next);
  };

  const handleApply = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setApplying(true);
    try {
      const blob = await canvasCropToJpegBlob(imageSrc, croppedAreaPixels);
      const file = new File([blob], "profile-avatar.jpg", { type: "image/jpeg" });
      await onApply(file);
      handleClose(false);
    } catch {
      /* Parent shows validation error; keep dialog open */
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md border-white/10 bg-[#15162b] text-slate-100 sm:rounded-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg text-slate-100">
            Adjust photo
          </DialogTitle>
          <p className="text-sm text-slate-400">
            Drag to reposition, use the slider to zoom. The preview matches your profile circle.
          </p>
        </DialogHeader>

        {imageSrc ? (
          <div className="space-y-4">
            <div className="relative mx-auto h-[min(72vw,280px)] w-[min(72vw,280px)] overflow-hidden rounded-xl bg-black/40">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className="space-y-2 px-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Zoom</span>
                <span>{zoom.toFixed(2)}×</span>
              </div>
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.01}
                onValueChange={(v) => setZoom(v[0] ?? 1)}
                className="w-full"
              />
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            onClick={() => handleClose(false)}
            disabled={applying}
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={applying || !croppedAreaPixels}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
          >
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Use photo
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
