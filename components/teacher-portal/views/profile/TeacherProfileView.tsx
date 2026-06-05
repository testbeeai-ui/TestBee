"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, LogOut, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TeacherPortalProfileView } from "@/lib/teacherPortal/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { AvatarCropDialog } from "@/components/teacher-portal/views/profile/AvatarCropDialog";

const PROFILE_AVATARS_BUCKET = "profile-avatars";
type ContactEmailVerificationUiState =
  | "unverifiedIdle"
  | "otpInProgress"
  | "confirmedPendingPersist"
  | "verifiedPersisted";

/** Human-readable copy for common Supabase Auth errors (OTP send / verify). */
function formatSupabaseAuthError(raw: string): string {
  const m = raw.toLowerCase();
  if (
    m.includes("rate limit") ||
    m.includes("too many") ||
    m.includes("429") ||
    m.includes("over_email_send_rate_limit") ||
    m.includes("email rate limit")
  ) {
    return "Too many attempts. Wait a few minutes before requesting another code.";
  }
  if (m.includes("invalid") && (m.includes("email") || m.includes("address"))) {
    return "That email address could not be used. Check it or try another.";
  }
  return raw;
}

function indianPhoneDigits(v: string): string {
  const digits = v.replace(/\D/g, "");
  if (digits.length <= 10) return digits;
  if (digits.startsWith("91")) return digits.slice(2, 12);
  return digits.slice(0, 10);
}

function formatIndianPhone(v: string): string {
  const digits = indianPhoneDigits(v);
  return digits ? `+91 ${digits}` : "+91";
}

interface TeacherProfileViewProps {
  profile: TeacherPortalProfileView;
  /** When true, auto-open profile in edit mode (verification CTA flow). */
  autoStartEditing?: boolean;
  /** When false (e.g. admin viewing another teacher), avatar upload is hidden. Default true. */
  allowAvatarUpload?: boolean;
  /** Called after a successful avatar upload so portal data can refresh. */
  onAvatarUpdated?: () => void | Promise<void>;
  onSave: (input: {
    userId: string;
    name: string;
    bio: string;
    visibility: string;
    subjects: string[];
    examTags: string[];
    teachingLevels: number[];
    details?: {
      location?: string;
      qualification?: string;
      experience?: string;
      email?: string;
      phone?: string;
      youtubeOrSocial?: string;
      docs?: {
        aadharPhotoUrl?: string;
        aadharShareLink?: string;
        instituteCertificatePhotoUrl?: string;
        instituteCertificateShareLink?: string;
      };
    };
  }) => Promise<void>;
}

export default function TeacherProfileView({
  profile,
  onSave,
  autoStartEditing = false,
  allowAvatarUpload = true,
  onAvatarUpdated,
}: TeacherProfileViewProps) {
  const { user, refreshProfile, signOut } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [visibility, setVisibility] = useState(profile.visibility);
  const [subjectsInput, setSubjectsInput] = useState((profile.subjects ?? []).join(", "));
  const [examTagsInput, setExamTagsInput] = useState((profile.examTags ?? []).join(", "));
  const [teachingLevelsInput, setTeachingLevelsInput] = useState(
    (profile.teachingLevels ?? []).join(", ")
  );
  const [location, setLocation] = useState(profile.details?.location ?? "");
  const [qualification, setQualification] = useState(profile.details?.qualification ?? "");
  const [experience, setExperience] = useState(profile.details?.experience ?? "");
  const [email, setEmail] = useState(() => {
    const saved = (profile.details?.email ?? "").trim();
    return saved;
  });
  const [phone, setPhone] = useState(() => indianPhoneDigits(profile.details?.phone ?? ""));
  const [youtubeOrSocial, setYoutubeOrSocial] = useState(profile.details?.youtubeOrSocial ?? "");
  const [aadharPhotoUrl, setAadharPhotoUrl] = useState(profile.details?.docs?.aadharPhotoUrl ?? "");
  const [aadharShareLink, setAadharShareLink] = useState(
    profile.details?.docs?.aadharShareLink ?? ""
  );
  const [instituteCertificatePhotoUrl, setInstituteCertificatePhotoUrl] = useState(
    profile.details?.docs?.instituteCertificatePhotoUrl ?? ""
  );
  const [instituteCertificateShareLink, setInstituteCertificateShareLink] = useState(
    profile.details?.docs?.instituteCertificateShareLink ?? ""
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadingAadhar, setUploadingAadhar] = useState(false);
  const [uploadingCertificate, setUploadingCertificate] = useState(false);
  const [openingAadhar, setOpeningAadhar] = useState(false);
  const [openingCertificate, setOpeningCertificate] = useState(false);
  const aadharFileInputRef = useRef<HTMLInputElement | null>(null);
  const certificateFileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarCropOpen, setAvatarCropOpen] = useState(false);
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);
  const [optimisticVerificationStatus, setOptimisticVerificationStatus] = useState<
    "unverified" | "pending" | "approved" | "rejected" | null
  >(null);

  const [emailOtpMode, setEmailOtpMode] = useState<null | "same" | "change">(null);
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [emailOtpBusy, setEmailOtpBusy] = useState(false);
  const [optimisticVerifiedEmail, setOptimisticVerifiedEmail] = useState<string | null>(null);
  const [pendingVerificationPersistEmail, setPendingVerificationPersistEmail] = useState("");
  const pendingVerifyEmailRef = useRef<string>("");

  const canManageAvatar = Boolean(allowAvatarUpload && user?.id && profile.id === user.id);

  const verificationStatus =
    optimisticVerificationStatus ?? profile.details?.verificationStatus ?? "unverified";
  const isApproved = verificationStatus === "approved";
  const isPending = verificationStatus === "pending";
  const isRejected = verificationStatus === "rejected";
  const lockVerifiedFields = isApproved;

  useEffect(() => {
    return () => {
      if (avatarCropSrc) URL.revokeObjectURL(avatarCropSrc);
    };
  }, [avatarCropSrc]);

  useEffect(() => {
    setName(profile.name);
    setBio(profile.bio ?? "");
    setVisibility(profile.visibility);
    setSubjectsInput((profile.subjects ?? []).join(", "));
    setExamTagsInput((profile.examTags ?? []).join(", "));
    setTeachingLevelsInput((profile.teachingLevels ?? []).join(", "));
    setLocation(profile.details?.location ?? "");
    setQualification(profile.details?.qualification ?? "");
    setExperience(profile.details?.experience ?? "");
    const savedEmail = (profile.details?.email ?? "").trim();
    setEmail(savedEmail || (user?.email ?? "").trim());
    setPhone(indianPhoneDigits(profile.details?.phone ?? ""));
    setYoutubeOrSocial(profile.details?.youtubeOrSocial ?? "");
    setAadharPhotoUrl(profile.details?.docs?.aadharPhotoUrl ?? "");
    setAadharShareLink(profile.details?.docs?.aadharShareLink ?? "");
    setInstituteCertificatePhotoUrl(profile.details?.docs?.instituteCertificatePhotoUrl ?? "");
    setInstituteCertificateShareLink(profile.details?.docs?.instituteCertificateShareLink ?? "");
    setValidationError(null);
    setOpeningAadhar(false);
    setOpeningCertificate(false);
    setPendingVerificationPersistEmail("");
    setEmailOtpMode(null);
    setEmailOtpCode("");
    pendingVerifyEmailRef.current = "";
    setOptimisticVerificationStatus(null);
  }, [profile, user?.email]);

  useEffect(() => {
    if (autoStartEditing) {
      setEditing(true);
    }
  }, [autoStartEditing]);

  const initials =
    profile.name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "T";

  const normalizeEmail = (v: string) => v.trim().toLowerCase();
  const phoneLocalPart = indianPhoneDigits(phone);

  const handlePhoneChange = (raw: string) => {
    // Keep only the user-entered 10-digit local number; prefix is rendered separately.
    const digits = indianPhoneDigits(raw);
    setPhone(digits);
  };
  const currentContactEmail = (profile.details?.email ?? user?.email ?? "").trim();
  const verifiedContactEmail = (profile.details?.verifiedContactEmail ?? "").trim();

  const contactEmailShowsVerified = Boolean(
    profile.details.contactEmailVerifiedAt &&
    currentContactEmail &&
    verifiedContactEmail &&
    normalizeEmail(currentContactEmail) === normalizeEmail(verifiedContactEmail)
  );
  const optimisticContactEmailShowsVerified = Boolean(
    optimisticVerifiedEmail && normalizeEmail(email) === normalizeEmail(optimisticVerifiedEmail)
  );
  const contactEmailIsVerified = contactEmailShowsVerified || optimisticContactEmailShowsVerified;
  const contactEmailPendingPersist = Boolean(
    pendingVerificationPersistEmail &&
    normalizeEmail(email) === normalizeEmail(pendingVerificationPersistEmail)
  );
  const contactEmailVerificationUiState: ContactEmailVerificationUiState = contactEmailIsVerified
    ? "verifiedPersisted"
    : emailOtpMode
      ? "otpInProgress"
      : contactEmailPendingPersist
        ? "confirmedPendingPersist"
        : "unverifiedIdle";

  const clearEmailOtpFlow = () => {
    setEmailOtpMode(null);
    setEmailOtpCode("");
    pendingVerifyEmailRef.current = "";
  };

  useEffect(() => {
    if (contactEmailShowsVerified) {
      setOptimisticVerifiedEmail(null);
      setPendingVerificationPersistEmail("");
    }
  }, [contactEmailShowsVerified]);

  const applyVerifiedContactEmailToDetails = async (address: string) => {
    const trimmed = address.trim();
    const verifiedNorm = trimmed.toLowerCase();
    const sbAny = supabase as unknown as {
      from: (t: string) => {
        update: (row: Record<string, unknown>) => {
          eq: (
            c: string,
            v: string
          ) => {
            select: (
              cols: string
            ) => Promise<{ data: unknown[] | null; error: { message?: string } | null }>;
          };
        };
      };
    };
    const payload = {
      email: trimmed,
      verified_contact_email: verifiedNorm,
      contact_email_verified_at: new Date().toISOString(),
    };
    return sbAny
      .from("teacher_profile_details")
      .update(payload)
      .eq("teacher_id", profile.id)
      .select("teacher_id");
  };

  const sendContactEmailOtp = async () => {
    if (!canManageAvatar) {
      toast({
        variant: "destructive",
        title: "Email verification unavailable",
        description:
          "You can only send a code while signed in as this teacher (not in admin view).",
      });
      return;
    }
    if (!user?.email) {
      toast({
        variant: "destructive",
        title: "No login email",
        description:
          "Your account has no email on file. Add one in account settings, then try again.",
      });
      return;
    }
    const target = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      setValidationError("Enter a valid email address.");
      return;
    }
    setValidationError(null);
    setOptimisticVerifiedEmail(null);
    setPendingVerificationPersistEmail("");
    setEmailOtpBusy(true);
    try {
      const authEmail = user.email.toLowerCase();
      if (target.toLowerCase() === authEmail) {
        const { error } = await supabase.auth.signInWithOtp({
          email: user.email,
          options: { shouldCreateUser: false },
        });
        if (error) throw error;
        pendingVerifyEmailRef.current = target;
        setEmailOtpMode("same");
        toast({
          title: "Code sent",
          description: "Check your inbox for the verification code.",
        });
      } else {
        const { error } = await supabase.auth.updateUser({ email: target });
        if (error) throw error;
        pendingVerifyEmailRef.current = target;
        setEmailOtpMode("change");
        toast({
          title: "Code sent",
          description:
            "We emailed a code to this address. Enter it below — your login email will update to match.",
        });
      }
      setEmailOtpCode("");
    } catch (e) {
      const raw =
        e instanceof Error
          ? e.message
          : e &&
              typeof e === "object" &&
              "message" in e &&
              typeof (e as { message: unknown }).message === "string"
            ? (e as { message: string }).message
            : String(e);
      const friendly = formatSupabaseAuthError(raw);
      setValidationError(`Could not send code: ${friendly}`);
      toast({
        variant: "destructive",
        title: "Could not send code",
        description: friendly,
      });
    } finally {
      setEmailOtpBusy(false);
    }
  };

  const verifyContactEmailOtp = async () => {
    if (!canManageAvatar || !user?.email || !emailOtpMode) {
      if (!canManageAvatar) {
        toast({
          variant: "destructive",
          title: "Email verification unavailable",
          description: "You can only confirm while signed in as this teacher (not in admin view).",
        });
      } else if (!user?.email) {
        toast({
          variant: "destructive",
          title: "No login email",
          description: "Refresh the page or sign in again, then try confirming the code.",
        });
      }
      return;
    }
    const token = emailOtpCode.replace(/\s/g, "");
    if (token.length < 6) {
      setValidationError("Enter the verification code from your email.");
      return;
    }
    const pending = pendingVerifyEmailRef.current.trim();
    if (!pending) {
      setValidationError("Send a code first.");
      return;
    }
    setValidationError(null);
    setEmailOtpBusy(true);
    try {
      if (emailOtpMode === "same") {
        const { error } = await supabase.auth.verifyOtp({
          email: user.email,
          token,
          type: "email",
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.verifyOtp({
          email: pending,
          token,
          type: "email_change",
        });
        if (error) throw error;
      }

      setEmail(pending);
      setOptimisticVerifiedEmail(null);
      clearEmailOtpFlow();
      const updateRes = await applyVerifiedContactEmailToDetails(pending);

      if (updateRes.error || !updateRes.data?.length) {
        setPendingVerificationPersistEmail(pending);
        const rawStore = updateRes.error?.message ?? "";
        const docConstraintError = rawStore.includes("teacher_profile_details_doc_presence_chk");
        const missingDetailsRow = !updateRes.error && !updateRes.data?.length;
        const msg = docConstraintError
          ? "Code confirmed. Add Aadhaar and institute certificate, then Submit to persist verification."
          : missingDetailsRow
            ? "Code confirmed. Complete required profile details, then Submit to persist verification."
            : "Code confirmed. Complete details, then Submit to persist verification.";
        setValidationError(msg);
        toast({
          title: "Code confirmed",
          description: msg,
        });
        return;
      }

      setPendingVerificationPersistEmail("");
      setOptimisticVerifiedEmail(null);
      await refreshProfile();
      await onAvatarUpdated?.();
      toast({ title: "Email verified" });
    } catch (e) {
      const raw =
        e instanceof Error
          ? e.message
          : e &&
              typeof e === "object" &&
              "message" in e &&
              typeof (e as { message: unknown }).message === "string"
            ? (e as { message: string }).message
            : String(e);
      const friendly = formatSupabaseAuthError(raw);
      setValidationError(`Email verification failed: ${friendly}`);
      toast({
        variant: "destructive",
        title: "Email verification failed",
        description: friendly,
      });
    } finally {
      setEmailOtpBusy(false);
    }
  };

  const discardAvatarCrop = () => {
    if (avatarCropSrc) {
      URL.revokeObjectURL(avatarCropSrc);
      setAvatarCropSrc(null);
    }
  };

  const openAvatarCropFromFile = (file: File | null) => {
    if (!file || !canManageAvatar) return;
    discardAvatarCrop();
    const url = URL.createObjectURL(file);
    setAvatarCropSrc(url);
    setAvatarCropOpen(true);
    if (avatarPhotoInputRef.current) avatarPhotoInputRef.current.value = "";
  };

  const uploadAvatarFile = async (file: File) => {
    setValidationError(null);
    setUploadingAvatar(true);
    try {
      const path = `${profile.id}/avatar-${Date.now()}.jpg`;
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
        .eq("id", profile.id);
      if (dbErr) throw dbErr;
      await refreshProfile();
      await onAvatarUpdated?.();
      toast({ title: "Profile photo updated" });
    } catch (e) {
      const raw =
        e instanceof Error
          ? e.message
          : e &&
              typeof e === "object" &&
              "message" in e &&
              typeof (e as { message: unknown }).message === "string"
            ? (e as { message: string }).message
            : String(e);
      const bucketHint = /bucket not found/i.test(raw)
        ? " On your Supabase project, create the public bucket profile-avatars or apply migrations (supabase db push). Also confirm NEXT_PUBLIC_SUPABASE_URL matches that project."
        : "";
      setValidationError(`Photo upload failed: ${raw}.${bucketHint}`);
      throw e;
    } finally {
      setUploadingAvatar(false);
    }
  };

  const uploadVerificationDoc = async (
    file: File,
    kind: "aadhar" | "certificate"
  ): Promise<string> => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${profile.id}/${kind}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("teacher-verification-docs").upload(path, file, {
      contentType: file.type || undefined,
      upsert: true,
    });
    if (error) throw error;
    return `storage://teacher-verification-docs/${path}`;
  };

  const parseTeacherVerificationDocPath = (value: string): string | null => {
    const trimmed = value.trim();
    const prefix = "storage://teacher-verification-docs/";
    if (!trimmed) return null;
    if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
    return null;
  };

  const isTeacherVerificationStorageUri = (value: string) =>
    value.trim().startsWith("storage://teacher-verification-docs/");

  const maskedTeacherVerificationLabel = (value: string) => {
    const path = parseTeacherVerificationDocPath(value);
    if (!path) return value;
    const tail = path.slice(-10);
    return `Private upload stored (…${tail})`;
  };

  const openTeacherVerificationDoc = async (value: string, kind: "aadhar" | "certificate") => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setValidationError(null);

    const setOpening = kind === "aadhar" ? setOpeningAadhar : setOpeningCertificate;
    setOpening(true);
    try {
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        window.open(trimmed, "_blank", "noopener,noreferrer");
        return;
      }

      const path = parseTeacherVerificationDocPath(trimmed);
      if (!path) {
        throw new Error("Unsupported document link. Please upload again or paste a valid link.");
      }

      const { data, error } = await supabase.storage
        .from("teacher-verification-docs")
        .createSignedUrl(path, 60);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error("Failed to generate a secure link.");

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      setValidationError(
        e instanceof Error ? `Could not open document: ${e.message}` : "Could not open document."
      );
    } finally {
      setOpening(false);
    }
  };

  const onPickAadharFile = async (file: File | null) => {
    if (!file) return;
    setValidationError(null);
    setUploadingAadhar(true);
    try {
      const storagePath = await uploadVerificationDoc(file, "aadhar");
      setAadharPhotoUrl(storagePath);
    } catch (e) {
      setValidationError(
        e instanceof Error
          ? `Aadhaar upload failed: ${e.message}`
          : "Aadhaar upload failed. Please try again."
      );
    } finally {
      setUploadingAadhar(false);
      if (aadharFileInputRef.current) aadharFileInputRef.current.value = "";
    }
  };

  const onPickCertificateFile = async (file: File | null) => {
    if (!file) return;
    setValidationError(null);
    setUploadingCertificate(true);
    try {
      const storagePath = await uploadVerificationDoc(file, "certificate");
      setInstituteCertificatePhotoUrl(storagePath);
    } catch (e) {
      setValidationError(
        e instanceof Error
          ? `Certificate upload failed: ${e.message}`
          : "Certificate upload failed. Please try again."
      );
    } finally {
      setUploadingCertificate(false);
      if (certificateFileInputRef.current) certificateFileInputRef.current.value = "";
    }
  };

  const save = async () => {
    setValidationError(null);

    const parsedSubjects = subjectsInput
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const parsedExamTags = examTagsInput
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const parsedLevels = teachingLevelsInput
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((value) => Number.isFinite(value) && value > 0);

    const hasAadhar = Boolean(aadharPhotoUrl.trim() || aadharShareLink.trim());
    const hasInstituteCertificate = Boolean(
      instituteCertificatePhotoUrl.trim() || instituteCertificateShareLink.trim()
    );
    const cleanName = name.trim();
    const cleanLocation = location.trim();
    const cleanQualification = qualification.trim();
    const cleanExperience = experience.trim();

    if (!cleanName) {
      setValidationError("Full name is required.");
      return;
    }
    if (parsedSubjects.length === 0) {
      setValidationError("At least one subject is required.");
      return;
    }
    if (parsedExamTags.length === 0) {
      setValidationError("Specialisation is required.");
      return;
    }
    if (!cleanLocation) {
      setValidationError("Location is required.");
      return;
    }
    if (!cleanQualification) {
      setValidationError("Qualification is required.");
      return;
    }
    if (!cleanExperience) {
      setValidationError("Experience is required.");
      return;
    }
    if (phoneLocalPart.length !== 10) {
      setValidationError("Phone must be a valid +91 number with 10 digits.");
      return;
    }
    if (!hasAadhar || !hasInstituteCertificate) {
      setValidationError("Add Aadhaar proof and institute certificate before Save.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        userId: profile.id,
        name,
        bio,
        visibility,
        subjects: parsedSubjects,
        examTags: parsedExamTags,
        teachingLevels: parsedLevels,
        details: {
          location: cleanLocation,
          qualification: cleanQualification,
          experience: cleanExperience,
          email: email.trim(),
          phone: phoneLocalPart ? `+91 ${phoneLocalPart}` : "",
          youtubeOrSocial: youtubeOrSocial.trim(),
          docs: {
            aadharPhotoUrl: aadharPhotoUrl.trim(),
            aadharShareLink: aadharShareLink.trim(),
            instituteCertificatePhotoUrl: instituteCertificatePhotoUrl.trim(),
            instituteCertificateShareLink: instituteCertificateShareLink.trim(),
          },
        },
      });
      if (pendingVerificationPersistEmail) {
        const pendingAddress = pendingVerificationPersistEmail;
        const verificationRes = await applyVerifiedContactEmailToDetails(pendingAddress);
        if (!verificationRes.error && verificationRes.data?.length) {
          setPendingVerificationPersistEmail("");
          setOptimisticVerifiedEmail(null);
          await refreshProfile();
          await onAvatarUpdated?.();
          toast({ title: "Email verification saved" });
        }
      }
      setValidationError(null);
      if (!isApproved) {
        setOptimisticVerificationStatus("pending");
      }

      setEditing(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not save profile.";
      setValidationError(message);
      toast({
        variant: "destructive",
        title: "Save failed",
        description: message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-serif text-3xl sm:text-4xl">
          My <span className="text-emerald-400 italic">Profile</span>
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5 sm:px-4 sm:py-2 sm:text-sm"
          >
            {editing ? "Cancel edit" : "Edit profile"}
          </button>
          {editing ? (
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-60 sm:px-4 sm:py-2 sm:text-sm"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit
            </button>
          ) : (
            <button
              type="button"
              disabled={signingOut}
              onClick={() => {
                if (signingOut) return;
                setSigningOut(true);
                void signOut();
              }}
              className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-70 sm:px-4 sm:py-2 sm:text-sm"
            >
              {signingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              {signingOut ? "Logging out…" : "Log Out"}
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#15162b] p-4 sm:p-6">
        {editing && !isApproved ? (
          <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-200">
            Edit mode active - update your profile details and save changes.
          </div>
        ) : null}
        {validationError ? (
          <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200">
            {validationError}
          </div>
        ) : null}
        {isApproved ? (
          <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-200">
            Verification approved - core identity fields are locked.
          </div>
        ) : null}
        {isPending ? (
          <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-100">
            Verification pending - your profile is under admin review.
          </div>
        ) : null}
        {isRejected ? (
          <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            <p className="font-semibold">Verification rejected</p>
            <p className="mt-1">
              {(profile.details?.adminNotes ?? "").trim() ||
                "Please update your details/documents and submit again."}
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <Avatar className="h-20 w-20 border-2 border-violet-400/50">
              <AvatarImage src={profile.avatarUrl ?? undefined} alt="" className="object-cover" />
              <AvatarFallback className="rounded-full bg-violet-500/10 text-2xl font-bold text-violet-200">
                {initials}
              </AvatarFallback>
            </Avatar>
            {canManageAvatar ? (
              <>
                <input
                  ref={avatarPhotoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => openAvatarCropFromFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => avatarPhotoInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold text-violet-200 hover:bg-violet-500/20 disabled:opacity-60"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {uploadingAvatar ? "Uploading…" : "Change photo"}
                </button>
              </>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-serif text-3xl sm:text-4xl">{name || profile.name}</div>
            <div className="mt-2 text-sm text-slate-400">
              {subjectsInput
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
                .join(" · ") ||
                profile.subjects.join(" · ") ||
                "Teacher"}{" "}
              · EduBlast teacher
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(examTagsInput
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean).length
                ? examTagsInput
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean)
                : profile.examTags
              ).map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-violet-500/10 px-2 py-1 text-xs font-semibold text-violet-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-center">
            <div className="font-serif text-2xl text-emerald-300 sm:text-3xl">
              {profile.studentsHelped.toLocaleString("en-IN")}
            </div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
              Students helped
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-center">
            <div className="font-serif text-2xl text-amber-300 sm:text-3xl">
              {profile.rdm.toLocaleString("en-IN")}
            </div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">RDM earned</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-center">
            <div className="font-serif text-2xl sm:text-3xl">4.9★</div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
              Class rating
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-center">
            <div className="font-serif text-2xl text-violet-300 sm:text-3xl">
              {profile.expertAnswers.toLocaleString("en-IN")}
            </div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
              Expert answers
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-[#15162b] p-4">
          <h3 className="mb-3 text-sm font-semibold">Teaching details</h3>
          <div className="overflow-hidden rounded-lg border border-white/10">
            <div className="grid grid-cols-[140px_1fr] border-b border-white/10 bg-black/10 px-3 py-2 text-sm">
              <div className="text-slate-500">Full name</div>
              <div className="text-slate-200">
                {editing ? (
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={lockVerifiedFields}
                    className="h-9 w-full rounded-md border border-white/20 bg-[#07070f] px-3 text-sm outline-none focus:border-violet-400"
                  />
                ) : (
                  profile.name
                )}
              </div>
            </div>
            <div className="grid grid-cols-[140px_1fr] border-b border-white/10 px-3 py-2 text-sm">
              <div className="text-slate-500">Subjects</div>
              <div className="text-slate-200">
                {editing ? (
                  <input
                    value={subjectsInput}
                    onChange={(e) => setSubjectsInput(e.target.value)}
                    placeholder="Physics, Chemistry, Math"
                    disabled={lockVerifiedFields}
                    className="h-9 w-full rounded-md border border-white/20 bg-[#07070f] px-3 text-sm outline-none focus:border-violet-400"
                  />
                ) : (
                  profile.subjects.join(", ") || "—"
                )}
              </div>
            </div>
            <div className="grid grid-cols-[140px_1fr] border-b border-white/10 bg-black/10 px-3 py-2 text-sm">
              <div className="text-slate-500">Specialisation</div>
              <div className="text-slate-200">
                {editing ? (
                  <input
                    value={examTagsInput}
                    onChange={(e) => setExamTagsInput(e.target.value)}
                    placeholder="JEE Advanced, NEET"
                    disabled={lockVerifiedFields}
                    className="h-9 w-full rounded-md border border-white/20 bg-[#07070f] px-3 text-sm outline-none focus:border-violet-400"
                  />
                ) : (
                  profile.examTags.join(", ") || "—"
                )}
              </div>
            </div>
            <div className="grid grid-cols-[140px_1fr] border-b border-white/10 px-3 py-2 text-sm">
              <div className="text-slate-500">Location</div>
              <div className="text-slate-200">
                {editing ? (
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Bengaluru, Karnataka"
                    disabled={lockVerifiedFields}
                    className="h-9 w-full rounded-md border border-white/20 bg-[#07070f] px-3 text-sm outline-none focus:border-violet-400"
                  />
                ) : (
                  profile.details?.location || "—"
                )}
              </div>
            </div>
            <div className="grid grid-cols-[140px_1fr] border-b border-white/10 bg-black/10 px-3 py-2 text-sm">
              <div className="text-slate-500">Qualification</div>
              <div className="text-slate-200">
                {editing ? (
                  <input
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    placeholder="M.Sc Physics, IIT Bombay"
                    disabled={lockVerifiedFields}
                    className="h-9 w-full rounded-md border border-white/20 bg-[#07070f] px-3 text-sm outline-none focus:border-violet-400"
                  />
                ) : (
                  profile.details?.qualification || "—"
                )}
              </div>
            </div>
            <div className="grid grid-cols-[140px_1fr] border-b border-white/10 px-3 py-2 text-sm">
              <div className="text-slate-500">Experience</div>
              <div className="text-slate-200">
                {editing ? (
                  <input
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    placeholder="22 years teaching PUC PCM"
                    disabled={lockVerifiedFields}
                    className="h-9 w-full rounded-md border border-white/20 bg-[#07070f] px-3 text-sm outline-none focus:border-violet-400"
                  />
                ) : (
                  profile.details?.experience || "—"
                )}
              </div>
            </div>
            <div className="grid grid-cols-[140px_1fr] border-b border-white/10 bg-black/10 px-3 py-2 text-sm">
              <div className="text-slate-500">Contact email</div>
              <div className="text-slate-200">
                {editing ? (
                  <input
                    value={email}
                    readOnly
                    disabled
                    title="Contact email cannot be changed here."
                    className="h-9 min-w-[12rem] w-full max-w-md rounded-md border border-white/20 bg-[#07070f] px-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-70"
                  />
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{profile.details?.email?.trim() || user?.email || "—"}</span>
                    {contactEmailIsVerified ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Email verified
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-[140px_1fr] border-b border-white/10 px-3 py-2 text-sm">
              <div className="text-slate-500">Phone</div>
              <div className="text-slate-200">
                {editing ? (
                  <div className="flex h-9 w-full items-center rounded-md border border-white/20 bg-[#07070f] text-sm focus-within:border-violet-400">
                    <span className="px-3 text-slate-400">+91</span>
                    <input
                      value={phoneLocalPart}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="1234567890"
                      disabled={lockVerifiedFields}
                      className="h-full w-full rounded-r-md bg-transparent px-2 outline-none"
                    />
                  </div>
                ) : profile.details?.phone && formatIndianPhone(profile.details.phone) !== "+91" ? (
                  formatIndianPhone(profile.details.phone)
                ) : (
                  "—"
                )}
              </div>
            </div>
            <div className="grid grid-cols-[140px_1fr] border-b border-white/10 bg-black/10 px-3 py-2 text-sm">
              <div className="text-slate-500">YouTube / Social</div>
              <div className="text-slate-200">
                {editing ? (
                  <input
                    value={youtubeOrSocial}
                    onChange={(e) => setYoutubeOrSocial(e.target.value)}
                    placeholder="youtube.com/@yourchannel"
                    className="h-9 w-full rounded-md border border-white/20 bg-[#07070f] px-3 text-sm outline-none focus:border-violet-400"
                  />
                ) : (
                  profile.details?.youtubeOrSocial || "—"
                )}
              </div>
            </div>
            <div className="border-b border-white/10 bg-black/20 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Identity documents
              </p>
              <p className="mt-1 text-[11px] leading-snug text-slate-500">
                Required before Save (admin review).
              </p>
            </div>
            <div className="grid grid-cols-[140px_1fr] border-b border-white/10 px-3 py-2 text-sm">
              <div className="text-slate-500">Aadhaar proof</div>
              <div className="text-slate-200 space-y-2">
                {editing ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={
                          isTeacherVerificationStorageUri(aadharPhotoUrl)
                            ? maskedTeacherVerificationLabel(aadharPhotoUrl)
                            : aadharPhotoUrl
                        }
                        onChange={(e) => {
                          if (isTeacherVerificationStorageUri(aadharPhotoUrl)) return;
                          setAadharPhotoUrl(e.target.value);
                        }}
                        readOnly={isTeacherVerificationStorageUri(aadharPhotoUrl)}
                        disabled={lockVerifiedFields}
                        placeholder="Aadhaar photo URL (optional if share link given)"
                        className="h-9 min-w-0 flex-1 rounded-md border border-white/20 bg-[#07070f] px-3 text-sm outline-none focus:border-violet-400"
                      />
                      <button
                        type="button"
                        disabled={lockVerifiedFields || openingAadhar || !aadharPhotoUrl.trim()}
                        onClick={() => void openTeacherVerificationDoc(aadharPhotoUrl, "aadhar")}
                        className="inline-flex h-9 items-center gap-1 rounded-md border border-white/15 bg-white/5 px-3 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-60"
                      >
                        {openingAadhar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        View
                      </button>
                      <input
                        ref={aadharFileInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => void onPickAadharFile(e.target.files?.[0] ?? null)}
                      />
                      <button
                        type="button"
                        onClick={() => aadharFileInputRef.current?.click()}
                        disabled={lockVerifiedFields || uploadingAadhar}
                        className="inline-flex h-9 items-center gap-1 rounded-md border border-violet-400/40 bg-violet-500/10 px-3 text-xs font-semibold text-violet-200 hover:bg-violet-500/20 disabled:opacity-60"
                      >
                        {uploadingAadhar ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        {uploadingAadhar
                          ? aadharPhotoUrl.trim()
                            ? "Replacing..."
                            : "Uploading..."
                          : aadharPhotoUrl.trim()
                            ? "Replace"
                            : "Upload"}
                      </button>
                    </div>
                    <input
                      value={aadharShareLink}
                      onChange={(e) => setAadharShareLink(e.target.value)}
                      disabled={lockVerifiedFields}
                      placeholder="Aadhaar shareable link"
                      className="h-9 w-full rounded-md border border-white/20 bg-[#07070f] px-3 text-sm outline-none focus:border-violet-400"
                    />
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={
                          openingAadhar || !(profile.details?.docs?.aadharPhotoUrl ?? "").trim()
                        }
                        onClick={() =>
                          void openTeacherVerificationDoc(
                            profile.details?.docs?.aadharPhotoUrl ?? "",
                            "aadhar"
                          )
                        }
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-white/15 bg-white/5 px-3 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-60"
                      >
                        {openingAadhar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        View document
                      </button>
                      <div className="min-w-0 text-xs text-slate-400">
                        {profile.details?.docs?.aadharPhotoUrl ? "Private (signed link)" : "—"}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">
                      {profile.details?.docs?.aadharShareLink || "—"}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-[140px_1fr] border-b border-white/10 bg-black/10 px-3 py-2 text-sm">
              <div className="text-slate-500">Institute certificate</div>
              <div className="text-slate-200 space-y-2">
                {editing ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={
                          isTeacherVerificationStorageUri(instituteCertificatePhotoUrl)
                            ? maskedTeacherVerificationLabel(instituteCertificatePhotoUrl)
                            : instituteCertificatePhotoUrl
                        }
                        onChange={(e) => {
                          if (isTeacherVerificationStorageUri(instituteCertificatePhotoUrl)) return;
                          setInstituteCertificatePhotoUrl(e.target.value);
                        }}
                        readOnly={isTeacherVerificationStorageUri(instituteCertificatePhotoUrl)}
                        disabled={lockVerifiedFields}
                        placeholder="Certificate photo URL (optional if share link given)"
                        className="h-9 min-w-0 flex-1 rounded-md border border-white/20 bg-[#07070f] px-3 text-sm outline-none focus:border-violet-400"
                      />
                      <button
                        type="button"
                        disabled={
                          lockVerifiedFields ||
                          openingCertificate ||
                          !instituteCertificatePhotoUrl.trim()
                        }
                        onClick={() =>
                          void openTeacherVerificationDoc(
                            instituteCertificatePhotoUrl,
                            "certificate"
                          )
                        }
                        className="inline-flex h-9 items-center gap-1 rounded-md border border-white/15 bg-white/5 px-3 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-60"
                      >
                        {openingCertificate ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        View
                      </button>
                      <input
                        ref={certificateFileInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => void onPickCertificateFile(e.target.files?.[0] ?? null)}
                      />
                      <button
                        type="button"
                        onClick={() => certificateFileInputRef.current?.click()}
                        disabled={lockVerifiedFields || uploadingCertificate}
                        className="inline-flex h-9 items-center gap-1 rounded-md border border-violet-400/40 bg-violet-500/10 px-3 text-xs font-semibold text-violet-200 hover:bg-violet-500/20 disabled:opacity-60"
                      >
                        {uploadingCertificate ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        {uploadingCertificate
                          ? instituteCertificatePhotoUrl.trim()
                            ? "Replacing..."
                            : "Uploading..."
                          : instituteCertificatePhotoUrl.trim()
                            ? "Replace"
                            : "Upload"}
                      </button>
                    </div>
                    <input
                      value={instituteCertificateShareLink}
                      onChange={(e) => setInstituteCertificateShareLink(e.target.value)}
                      disabled={lockVerifiedFields}
                      placeholder="Institute certificate shareable link"
                      className="h-9 w-full rounded-md border border-white/20 bg-[#07070f] px-3 text-sm outline-none focus:border-violet-400"
                    />
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={
                          openingCertificate ||
                          !(profile.details?.docs?.instituteCertificatePhotoUrl ?? "").trim()
                        }
                        onClick={() =>
                          void openTeacherVerificationDoc(
                            profile.details?.docs?.instituteCertificatePhotoUrl ?? "",
                            "certificate"
                          )
                        }
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-white/15 bg-white/5 px-3 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-60"
                      >
                        {openingCertificate ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        View document
                      </button>
                      <div className="min-w-0 text-xs text-slate-400">
                        {profile.details?.docs?.instituteCertificatePhotoUrl
                          ? "Private (signed link)"
                          : "—"}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">
                      {profile.details?.docs?.instituteCertificateShareLink || "—"}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-[140px_1fr] border-b border-white/10 px-3 py-2 text-sm">
              <div className="text-slate-500">Teaching levels</div>
              <div className="text-slate-200">
                {editing ? (
                  <input
                    value={teachingLevelsInput}
                    onChange={(e) => setTeachingLevelsInput(e.target.value)}
                    placeholder="1, 2, 3"
                    className="h-9 w-full rounded-md border border-white/20 bg-[#07070f] px-3 text-sm outline-none focus:border-violet-400"
                  />
                ) : profile.teachingLevels.length ? (
                  profile.teachingLevels.join(", ")
                ) : (
                  "—"
                )}
              </div>
            </div>
            <div className="grid grid-cols-[140px_1fr] bg-black/10 px-3 py-2 text-sm">
              <div className="text-slate-500">Visibility</div>
              <div className="text-slate-200">
                {editing ? (
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                    className="h-9 rounded-md border border-white/20 bg-[#07070f] px-2 text-sm outline-none focus:border-violet-400"
                  >
                    <option value="public">Public</option>
                    <option value="invite_only">Invite-only</option>
                  </select>
                ) : visibility === "invite_only" ? (
                  "Invite-only"
                ) : (
                  "Public"
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#15162b] p-4">
          <h3 className="mb-3 text-sm font-semibold">Bio shown to students</h3>
          {editing ? (
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={7}
              className="w-full rounded-lg border border-white/20 bg-[#07070f] px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-violet-400"
              placeholder="Write your teaching bio..."
            />
          ) : (
            <p className="text-sm leading-relaxed text-slate-300">
              {profile.bio || "No bio added yet."}
            </p>
          )}
        </div>
      </div>

      <AvatarCropDialog
        open={avatarCropOpen}
        onOpenChange={setAvatarCropOpen}
        imageSrc={avatarCropSrc}
        onApply={uploadAvatarFile}
        onDiscard={discardAvatarCrop}
      />
    </div>
  );
}
