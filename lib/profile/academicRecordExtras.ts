import type { Json } from "@/integrations/supabase/types";

/** Stored in `profiles.academic_record_extras` (jsonb). */
export type AcademicRecordExtrasShape = {
  classXSubjects?: {
    physicsScience?: string;
    mathematics?: string;
    chemistry?: string;
    english?: string;
    socialScience?: string;
    secondLanguage?: string;
  };
  classXISubjects?: {
    physicsScience?: string;
    mathematics?: string;
    chemistry?: string;
    english?: string;
    socialScience?: string;
    secondLanguage?: string;
  };
  classXIISubjects?: {
    physicsScience?: string;
    mathematics?: string;
    chemistry?: string;
    english?: string;
    socialScience?: string;
    secondLanguage?: string;
  };
  coaching?: {
    instituteName?: string;
    attendingSince?: string;
  };
  coachingXI?: {
    instituteName?: string;
    attendingSince?: string;
  };
  coachingXII?: {
    instituteName?: string;
    attendingSince?: string;
  };
  /** PUC II / Class XII ongoing — internal assessment %. */
  puc2InternalsPercent?: string;
};

export function parseAcademicRecordExtras(json: Json | null | undefined): AcademicRecordExtrasShape {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  const o = json as Record<string, unknown>;
  const cx = o.classXSubjects;
  const classXSubjects =
    cx && typeof cx === "object" && !Array.isArray(cx)
      ? {
          physicsScience: stringOrEmpty((cx as Record<string, unknown>).physicsScience),
          mathematics: stringOrEmpty((cx as Record<string, unknown>).mathematics),
          chemistry: stringOrEmpty((cx as Record<string, unknown>).chemistry),
          english: stringOrEmpty((cx as Record<string, unknown>).english),
          socialScience: stringOrEmpty((cx as Record<string, unknown>).socialScience),
          secondLanguage: stringOrEmpty((cx as Record<string, unknown>).secondLanguage),
        }
      : undefined;
  const ch = o.coaching;
  const coaching =
    ch && typeof ch === "object" && !Array.isArray(ch)
      ? {
          instituteName: stringOrEmpty((ch as Record<string, unknown>).instituteName),
          attendingSince: stringOrEmpty((ch as Record<string, unknown>).attendingSince),
        }
      : undefined;
  const cxi = o.classXISubjects;
  const classXISubjects =
    cxi && typeof cxi === "object" && !Array.isArray(cxi)
      ? {
          physicsScience: stringOrEmpty((cxi as Record<string, unknown>).physicsScience),
          mathematics: stringOrEmpty((cxi as Record<string, unknown>).mathematics),
          chemistry: stringOrEmpty((cxi as Record<string, unknown>).chemistry),
          english: stringOrEmpty((cxi as Record<string, unknown>).english),
          socialScience: stringOrEmpty((cxi as Record<string, unknown>).socialScience),
          secondLanguage: stringOrEmpty((cxi as Record<string, unknown>).secondLanguage),
        }
      : undefined;
  const cxii = o.classXIISubjects;
  const classXIISubjects =
    cxii && typeof cxii === "object" && !Array.isArray(cxii)
      ? {
          physicsScience: stringOrEmpty((cxii as Record<string, unknown>).physicsScience),
          mathematics: stringOrEmpty((cxii as Record<string, unknown>).mathematics),
          chemistry: stringOrEmpty((cxii as Record<string, unknown>).chemistry),
          english: stringOrEmpty((cxii as Record<string, unknown>).english),
          socialScience: stringOrEmpty((cxii as Record<string, unknown>).socialScience),
          secondLanguage: stringOrEmpty((cxii as Record<string, unknown>).secondLanguage),
        }
      : undefined;
  const chXi = o.coachingXI;
  const coachingXI =
    chXi && typeof chXi === "object" && !Array.isArray(chXi)
      ? {
          instituteName: stringOrEmpty((chXi as Record<string, unknown>).instituteName),
          attendingSince: stringOrEmpty((chXi as Record<string, unknown>).attendingSince),
        }
      : undefined;
  const chXii = o.coachingXII;
  const coachingXII =
    chXii && typeof chXii === "object" && !Array.isArray(chXii)
      ? {
          instituteName: stringOrEmpty((chXii as Record<string, unknown>).instituteName),
          attendingSince: stringOrEmpty((chXii as Record<string, unknown>).attendingSince),
        }
      : undefined;
  return {
    classXSubjects,
    classXISubjects,
    classXIISubjects,
    coaching,
    coachingXI,
    coachingXII,
    puc2InternalsPercent: stringOrEmpty(o.puc2InternalsPercent),
  };
}

function stringOrEmpty(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

export function extrasToJson(shape: AcademicRecordExtrasShape): Json {
  const out: Record<string, unknown> = {};
  if (shape.classXSubjects && Object.values(shape.classXSubjects).some(Boolean)) {
    out.classXSubjects = shape.classXSubjects;
  }
  if (shape.classXISubjects && Object.values(shape.classXISubjects).some(Boolean)) {
    out.classXISubjects = shape.classXISubjects;
  }
  if (shape.classXIISubjects && Object.values(shape.classXIISubjects).some(Boolean)) {
    out.classXIISubjects = shape.classXIISubjects;
  }
  if (shape.coaching && (shape.coaching.instituteName || shape.coaching.attendingSince)) {
    out.coaching = shape.coaching;
  }
  if (shape.coachingXI && (shape.coachingXI.instituteName || shape.coachingXI.attendingSince)) {
    out.coachingXI = shape.coachingXI;
  }
  if (shape.coachingXII && (shape.coachingXII.instituteName || shape.coachingXII.attendingSince)) {
    out.coachingXII = shape.coachingXII;
  }
  if (shape.puc2InternalsPercent?.trim()) {
    out.puc2InternalsPercent = shape.puc2InternalsPercent.trim();
  }
  return out as Json;
}
