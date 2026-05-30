"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { markProfileCompanionAvatarUploaded } from "@/lib/onboarding/profileCompanionOnboarding";
import { cn } from "@/lib/utils";

const PROFILE_AVATARS_BUCKET = "profile-avatars";

type StudentProfilePhotoUploadProps = {
  profileId: string;
  avatarUrl: string | null;
  initials: string;
  onUpdated: () => Promise<void>;
  className?: string;
};

export function StudentProfilePhotoUpload({
  profileId,
  avatarUrl,
  initials,
  onUpdated,
  className,
}: StudentProfilePhotoUploadProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Choose an image file", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const path = `${profileId}/avatar-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from(PROFILE_AVATARS_BUCKET)
        .upload(path, file, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(PROFILE_AVATARS_BUCKET).getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profileId);
      if (dbErr) throw dbErr;
      await onUpdated();
      markProfileCompanionAvatarUploaded();
      toast({ title: "Profile photo updated" });
    } catch (e) {
      toast({
        title: "Could not upload photo",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-3 dark:border-white/10 dark:bg-[#0c1017] sm:flex-row sm:items-center sm:p-4",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-emerald-500/40">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-emerald-600/20 text-sm font-black text-emerald-400">
              {initials.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-bold text-foreground dark:text-white">Profile photo</p>
          <p className="text-[11px] text-muted-foreground dark:text-slate-500">
            Upload a clear photo for your identity on EduBlast.
          </p>
        </div>
      </div>
      <div className="sm:ml-auto">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadFile(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="w-full gap-2 sm:w-auto"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          {avatarUrl ? "Change photo" : "Upload photo"}
        </Button>
      </div>
    </div>
  );
}
