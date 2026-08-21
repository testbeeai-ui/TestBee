/** Any normal email (college domains included). Not Gmail-only. */
export const EDUDECA_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

/** @deprecated Use EDUDECA_EMAIL_RE — kept as alias so old imports keep working briefly. */
export const EDUDECA_GMAIL_RE = EDUDECA_EMAIL_RE;

export type EduDecaInterestPayload = {
  email: string;
  classLevel: 11 | 12;
  institution: string;
  state: string;
  city: string;
};

export type AuthUserLookup = {
  findIdByEmail: (email: string) => Promise<string | null>;
};

export function buildEduDecaProfileUpsert(id: string, payload: EduDecaInterestPayload) {
  return {
    id,
    email: payload.email,
    class_level: payload.classLevel,
    institution_name: payload.institution,
    state: payload.state,
    city: payload.city,
  };
}

export function buildWaitlistUpsert(payload: EduDecaInterestPayload) {
  return {
    email: payload.email,
    class_level: payload.classLevel,
    institution: payload.institution,
    state: payload.state,
    city: payload.city,
  };
}

/**
 * Link interest to an existing Google Auth user if that email already signed in.
 * Do not create Auth users from typed form emails.
 */
export async function findExistingProfileUserId(
  email: string,
  auth: AuthUserLookup,
): Promise<string | null> {
  return auth.findIdByEmail(email);
}
