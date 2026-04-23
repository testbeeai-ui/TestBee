"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TeacherPortalProfileView } from "@/lib/teacherPortal/types";

interface TeacherProfileViewProps {
  profile: TeacherPortalProfileView;
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

export default function TeacherProfileView({ profile, onSave }: TeacherProfileViewProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
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
  const [email, setEmail] = useState(profile.details?.email ?? "");
  const [phone, setPhone] = useState(profile.details?.phone ?? "");
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
  const aadharFileInputRef = useRef<HTMLInputElement | null>(null);
  const certificateFileInputRef = useRef<HTMLInputElement | null>(null);

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
    setEmail(profile.details?.email ?? "");
    setPhone(profile.details?.phone ?? "");
    setYoutubeOrSocial(profile.details?.youtubeOrSocial ?? "");
    setAadharPhotoUrl(profile.details?.docs?.aadharPhotoUrl ?? "");
    setAadharShareLink(profile.details?.docs?.aadharShareLink ?? "");
    setInstituteCertificatePhotoUrl(profile.details?.docs?.instituteCertificatePhotoUrl ?? "");
    setInstituteCertificateShareLink(profile.details?.docs?.instituteCertificateShareLink ?? "");
    setValidationError(null);
  }, [profile]);

  const initials =
    profile.name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "T";

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

    if (!hasAadhar || !hasInstituteCertificate) {
      setValidationError(
        "Verification required: provide Aadhaar (photo URL or shareable link) and institute certificate (photo URL or shareable link)."
      );
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
          location: location.trim(),
          qualification: qualification.trim(),
          experience: experience.trim(),
          email: email.trim(),
          phone: phone.trim(),
          youtubeOrSocial: youtubeOrSocial.trim(),
          docs: {
            aadharPhotoUrl: aadharPhotoUrl.trim(),
            aadharShareLink: aadharShareLink.trim(),
            instituteCertificatePhotoUrl: instituteCertificatePhotoUrl.trim(),
            instituteCertificateShareLink: instituteCertificateShareLink.trim(),
          },
        },
      });
      setEditing(false);
      setValidationError(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-serif text-4xl">
          My <span className="text-emerald-400 italic">Profile</span>
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
          >
            {editing ? "Cancel edit" : "Edit profile"}
          </button>
          {editing ? (
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#15162b] p-6">
        {editing ? (
          <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-200">
            Edit mode active - update your profile details and save changes.
          </div>
        ) : null}
        {validationError ? (
          <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200">
            {validationError}
          </div>
        ) : null}
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-violet-400/50 bg-violet-500/10 text-2xl font-bold text-violet-200">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-serif text-4xl">{name || profile.name}</div>
            <div className="mt-2 text-sm text-slate-400">
              {subjectsInput
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
                .join(" · ") ||
                profile.subjects.join(" · ") ||
                "Teacher"}{" "}
              · EduBlast Verified Teacher
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
            <div className="font-serif text-3xl text-emerald-300">
              {profile.studentsHelped.toLocaleString("en-IN")}
            </div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
              Students helped
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-center">
            <div className="font-serif text-3xl text-amber-300">
              {profile.rdm.toLocaleString("en-IN")}
            </div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">RDM earned</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-center">
            <div className="font-serif text-3xl">4.9★</div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
              Class rating
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-center">
            <div className="font-serif text-3xl text-violet-300">
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
                    className="h-9 w-full rounded-md border border-white/20 bg-[#07070f] px-3 text-sm outline-none focus:border-violet-400"
                  />
                ) : (
                  profile.details?.experience || "—"
                )}
              </div>
            </div>
            <div className="grid grid-cols-[140px_1fr] border-b border-white/10 bg-black/10 px-3 py-2 text-sm">
              <div className="text-slate-500">Email</div>
              <div className="text-slate-200">
                {editing ? (
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teacher@example.com"
                    className="h-9 w-full rounded-md border border-white/20 bg-[#07070f] px-3 text-sm outline-none focus:border-violet-400"
                  />
                ) : (
                  profile.details?.email || "—"
                )}
              </div>
            </div>
            <div className="grid grid-cols-[140px_1fr] border-b border-white/10 px-3 py-2 text-sm">
              <div className="text-slate-500">Phone</div>
              <div className="text-slate-200">
                {editing ? (
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 00001"
                    className="h-9 w-full rounded-md border border-white/20 bg-[#07070f] px-3 text-sm outline-none focus:border-violet-400"
                  />
                ) : (
                  profile.details?.phone || "—"
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
            <div className="grid grid-cols-[140px_1fr] border-b border-white/10 px-3 py-2 text-sm">
              <div className="text-slate-500">Aadhaar proof</div>
              <div className="text-slate-200 space-y-2">
                {editing ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={aadharPhotoUrl}
                        onChange={(e) => setAadharPhotoUrl(e.target.value)}
                        placeholder="Aadhaar photo URL (optional if share link given)"
                        className="h-9 min-w-0 flex-1 rounded-md border border-white/20 bg-[#07070f] px-3 text-sm outline-none focus:border-violet-400"
                      />
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
                        disabled={uploadingAadhar}
                        className="inline-flex h-9 items-center gap-1 rounded-md border border-violet-400/40 bg-violet-500/10 px-3 text-xs font-semibold text-violet-200 hover:bg-violet-500/20 disabled:opacity-60"
                      >
                        {uploadingAadhar ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        Upload
                      </button>
                    </div>
                    <input
                      value={aadharShareLink}
                      onChange={(e) => setAadharShareLink(e.target.value)}
                      placeholder="Aadhaar shareable link"
                      className="h-9 w-full rounded-md border border-white/20 bg-[#07070f] px-3 text-sm outline-none focus:border-violet-400"
                    />
                  </>
                ) : (
                  <>
                    <div>{profile.details?.docs?.aadharPhotoUrl || "—"}</div>
                    <div>{profile.details?.docs?.aadharShareLink || "—"}</div>
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
                        value={instituteCertificatePhotoUrl}
                        onChange={(e) => setInstituteCertificatePhotoUrl(e.target.value)}
                        placeholder="Certificate photo URL (optional if share link given)"
                        className="h-9 min-w-0 flex-1 rounded-md border border-white/20 bg-[#07070f] px-3 text-sm outline-none focus:border-violet-400"
                      />
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
                        disabled={uploadingCertificate}
                        className="inline-flex h-9 items-center gap-1 rounded-md border border-violet-400/40 bg-violet-500/10 px-3 text-xs font-semibold text-violet-200 hover:bg-violet-500/20 disabled:opacity-60"
                      >
                        {uploadingCertificate ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        Upload
                      </button>
                    </div>
                    <input
                      value={instituteCertificateShareLink}
                      onChange={(e) => setInstituteCertificateShareLink(e.target.value)}
                      placeholder="Institute certificate shareable link"
                      className="h-9 w-full rounded-md border border-white/20 bg-[#07070f] px-3 text-sm outline-none focus:border-violet-400"
                    />
                  </>
                ) : (
                  <>
                    <div>{profile.details?.docs?.instituteCertificatePhotoUrl || "—"}</div>
                    <div>{profile.details?.docs?.instituteCertificateShareLink || "—"}</div>
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
    </div>
  );
}
