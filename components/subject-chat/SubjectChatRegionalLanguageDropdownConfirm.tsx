"use client";

import { useCallback, useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { DOUBT_SUPPORTED_LANGUAGES } from "@/lib/gyan/doubtSupportedLanguages";
import {
  saveSubjectChatRegionalLanguage,
  type SubjectChatQuotaResponse,
} from "@/lib/subscription/subjectChatClient";
import type { SubjectChatRegionalCode } from "@/lib/subscription/subjectChatRegionalLanguage";

type Props = {
  pendingCode: SubjectChatRegionalCode;
  accentColor: string;
  lightBg: string;
  accessToken: string | null | undefined;
  onCancel: () => void;
  onSaved: (patch: Partial<SubjectChatQuotaResponse>) => void;
  onError?: (message: string) => void;
};

export default function SubjectChatRegionalLanguageDropdownConfirm({
  pendingCode,
  accentColor,
  lightBg,
  accessToken,
  onCancel,
  onSaved,
  onError,
}: Props) {
  const [saving, setSaving] = useState(false);
  const pendingLang = DOUBT_SUPPORTED_LANGUAGES.find((l) => l.id === pendingCode);

  const handleConfirm = useCallback(async () => {
    if (!accessToken) return;
    setSaving(true);
    const result = await saveSubjectChatRegionalLanguage(accessToken, pendingCode);
    setSaving(false);
    if (!result.ok) {
      onError?.(result.error);
      onCancel();
      return;
    }
    onSaved({
      regionalLanguage: result.regionalLanguage,
      needsRegionalLanguageSelection: false,
      multilingual: true,
    });
  }, [accessToken, onCancel, onError, onSaved, pendingCode]);

  if (!pendingLang) return null;

  return (
    <div
      className="px-4 py-3.5"
      role="dialog"
      aria-label="Confirm your lesson chat language"
    >
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="mb-2.5 inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 disabled:opacity-50"
      >
        <ChevronLeft className="h-4 w-4" />
        Languages
      </button>
      <p className="text-[15px] font-semibold leading-snug text-slate-900">
        Lock <span style={{ color: accentColor }}>{pendingLang.native}</span>?
      </p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">
        Lesson chat will answer in <strong>English</strong> or{" "}
        <strong>{pendingLang.native}</strong> only. You cannot change this later.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={saving}
          className="inline-flex w-full items-center justify-center rounded-xl py-2.5 text-[13px] font-semibold text-white shadow-md transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: accentColor }}
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Yes, lock my language"
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="w-full rounded-xl py-2 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          style={{ backgroundColor: lightBg }}
        >
          Go back
        </button>
      </div>
    </div>
  );
}
