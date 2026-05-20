export type TeacherProfileDocs = {
  aadharPhotoUrl?: string;
  aadharShareLink?: string;
  instituteCertificatePhotoUrl?: string;
  instituteCertificateShareLink?: string;
};

export type TeacherProfileDetails = {
  location?: string;
  qualification?: string;
  experience?: string;
  email?: string;
  phone?: string;
  youtubeOrSocial?: string;
  docs?: TeacherProfileDocs;
};

export type TeacherProfileMeta = {
  v: 1;
  studentBio: string;
  details: TeacherProfileDetails;
};

const PREFIX = "__TEACHER_PROFILE_META__:";

function cleanText(value: unknown, maxLen = 300): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLen);
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseDocs(raw: unknown): TeacherProfileDocs {
  const o = asObject(raw);
  return {
    aadharPhotoUrl: cleanText(o.aadharPhotoUrl, 1200) || undefined,
    aadharShareLink: cleanText(o.aadharShareLink, 1200) || undefined,
    instituteCertificatePhotoUrl: cleanText(o.instituteCertificatePhotoUrl, 1200) || undefined,
    instituteCertificateShareLink: cleanText(o.instituteCertificateShareLink, 1200) || undefined,
  };
}

function parseDetails(raw: unknown): TeacherProfileDetails {
  const o = asObject(raw);
  const docs = parseDocs(o.docs);
  return {
    location: cleanText(o.location, 180) || undefined,
    qualification: cleanText(o.qualification, 220) || undefined,
    experience: cleanText(o.experience, 220) || undefined,
    email: cleanText(o.email, 180) || undefined,
    phone: cleanText(o.phone, 60) || undefined,
    youtubeOrSocial: cleanText(o.youtubeOrSocial, 1200) || undefined,
    docs:
      docs.aadharPhotoUrl ||
      docs.aadharShareLink ||
      docs.instituteCertificatePhotoUrl ||
      docs.instituteCertificateShareLink
        ? docs
        : undefined,
  };
}

/**
 * Parse `profiles.bio` that may contain either:
 * 1) plain student-facing bio text
 * 2) encoded meta payload prefixed with `__TEACHER_PROFILE_META__:`
 */
export function parseTeacherProfileMetaFromBio(
  bioRaw: string | null | undefined
): { studentBio: string; details: TeacherProfileDetails; hasEncodedMeta: boolean } {
  const bio = typeof bioRaw === "string" ? bioRaw.trim() : "";
  if (!bio) return { studentBio: "", details: {}, hasEncodedMeta: false };
  if (!bio.startsWith(PREFIX)) {
    return {
      studentBio: bio,
      details: {},
      hasEncodedMeta: false,
    };
  }

  const payloadRaw = bio.slice(PREFIX.length).trim();
  if (!payloadRaw) {
    return { studentBio: "", details: {}, hasEncodedMeta: true };
  }

  try {
    const parsed = JSON.parse(payloadRaw) as unknown;
    const obj = asObject(parsed);
    const v = Number(obj.v);
    const details = parseDetails(obj.details);
    const studentBio = cleanText(obj.studentBio, 4000);

    if (v !== 1) {
      return {
        studentBio,
        details,
        hasEncodedMeta: true,
      };
    }

    return {
      studentBio,
      details,
      hasEncodedMeta: true,
    };
  } catch {
    // Defensive fallback: if malformed, treat original as plain bio
    return {
      studentBio: bio,
      details: {},
      hasEncodedMeta: false,
    };
  }
}

/** Create canonical payload object for storage. */
export function buildTeacherProfileMeta(input: {
  studentBio?: string;
  details?: TeacherProfileDetails;
}): TeacherProfileMeta {
  const studentBio = cleanText(input.studentBio, 4000);
  const details = parseDetails(input.details);

  return {
    v: 1,
    studentBio,
    details,
  };
}

/**
 * Serialize metadata into a single string for `profiles.bio`.
 * Returns plain `studentBio` when no details are set.
 */
export function serializeTeacherProfileMetaToBio(input: {
  studentBio?: string;
  details?: TeacherProfileDetails;
}): string {
  const meta = buildTeacherProfileMeta(input);
  const d = meta.details;
  const hasDetails =
    Boolean(d.location) ||
    Boolean(d.qualification) ||
    Boolean(d.experience) ||
    Boolean(d.email) ||
    Boolean(d.phone) ||
    Boolean(d.youtubeOrSocial) ||
    Boolean(d.docs?.aadharPhotoUrl) ||
    Boolean(d.docs?.aadharShareLink) ||
    Boolean(d.docs?.instituteCertificatePhotoUrl) ||
    Boolean(d.docs?.instituteCertificateShareLink);

  if (!hasDetails) return meta.studentBio;

  return `${PREFIX}${JSON.stringify(meta)}`;
}

/** Small utility for UI: true if at least one KYC/verification doc reference is present. */
export function hasAnyTeacherDocs(details: TeacherProfileDetails | null | undefined): boolean {
  const d = details ?? {};
  return Boolean(
    d.docs?.aadharPhotoUrl ||
      d.docs?.aadharShareLink ||
      d.docs?.instituteCertificatePhotoUrl ||
      d.docs?.instituteCertificateShareLink
  );
}

/** Utility to validate minimal verification readiness (Aadhaar + institute cert, link or photo URL each). */
export function isTeacherVerificationReady(details: TeacherProfileDetails | null | undefined): boolean {
  const d = details?.docs;
  if (!d) return false;
  const hasAadhar = Boolean(cleanText(d.aadharPhotoUrl, 1200) || cleanText(d.aadharShareLink, 1200));
  const hasCert = Boolean(
    cleanText(d.instituteCertificatePhotoUrl, 1200) ||
      cleanText(d.instituteCertificateShareLink, 1200)
  );
  return hasAadhar && hasCert;
}

/** Optional convenience to merge details incrementally in UI forms. */
export function mergeTeacherProfileDetails(
  base: TeacherProfileDetails | null | undefined,
  patch: Partial<TeacherProfileDetails> | null | undefined
): TeacherProfileDetails {
  const b = parseDetails(base);
  const p = parseDetails(patch);
  return {
    ...b,
    ...p,
    docs: {
      ...(b.docs ?? {}),
      ...(p.docs ?? {}),
    },
  };
}
