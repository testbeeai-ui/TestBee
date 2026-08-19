export const EDUDECA_GMAIL_RE = /^[^\s@]+@gmail\.com$/i;

export type EduDecaInterestPayload = {
  email: string;
  classLevel: 11 | 12;
  institution: string;
  state: string;
  city: string;
};

export type AuthUserLookup = {
  findIdByEmail: (email: string) => Promise<string | null>;
  createIdForEmail: (email: string) => Promise<string>;
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

/** Same Gmail always maps to the same auth user id so edudeca_profiles stays one row. */
export async function resolveProfileUserId(email: string, auth: AuthUserLookup): Promise<string> {
  const existing = await auth.findIdByEmail(email);
  if (existing) return existing;
  return auth.createIdForEmail(email);
}
