import { supabase } from "@/integrations/supabase/client";

export type TeacherRdmChargeAction =
  | "create_classroom"
  | "create_section"
  | "create_assignment"
  | "schedule_session"
  | "generate_test";

/** rdm_config keys for teacher portal charges (deduct on action). */
export const TEACHER_RDM_CHARGE_CONFIG_KEYS: Record<TeacherRdmChargeAction, string> = {
  create_classroom: "teacher_create_classroom_rdm",
  create_section: "teacher_create_section_rdm",
  create_assignment: "teacher_create_assignment_rdm",
  schedule_session: "teacher_schedule_session_rdm",
  generate_test: "teacher_generate_test_rdm",
};

export const TEACHER_GYAN_REWARD_CONFIG_KEY = "gyan_teacher_answer_rdm";

export type TeacherRdmCosts = Record<TeacherRdmChargeAction, number> & {
  gyan_teacher_answer: number;
};

export const DEFAULT_TEACHER_RDM_COSTS: TeacherRdmCosts = {
  create_classroom: 30,
  create_section: 30,
  create_assignment: 10,
  schedule_session: 30,
  generate_test: 30,
  gyan_teacher_answer: 5,
};

const ALL_TEACHER_RDM_CONFIG_KEYS = [
  ...Object.values(TEACHER_RDM_CHARGE_CONFIG_KEYS),
  TEACHER_GYAN_REWARD_CONFIG_KEY,
] as const;

type RdmConfigClient = {
  from: (table: "rdm_config") => {
    select: (columns: string) => {
      in: (
        column: string,
        values: readonly string[]
      ) => PromiseLike<{
        data: Array<{ key: string; value: number | null }> | null;
        error: unknown;
      }>;
    };
  };
};

function clampTeacherRdmAmount(raw: number | null | undefined, fallback: number): number {
  const n = typeof raw === "number" ? Math.round(raw) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(500, n));
}

export function teacherRdmCostsFromRows(
  rows: Array<{ key: string; value: number | null }>
): TeacherRdmCosts {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out = { ...DEFAULT_TEACHER_RDM_COSTS };
  for (const action of Object.keys(TEACHER_RDM_CHARGE_CONFIG_KEYS) as TeacherRdmChargeAction[]) {
    const configKey = TEACHER_RDM_CHARGE_CONFIG_KEYS[action];
    out[action] = clampTeacherRdmAmount(byKey.get(configKey), DEFAULT_TEACHER_RDM_COSTS[action]);
  }
  out.gyan_teacher_answer = clampTeacherRdmAmount(
    byKey.get(TEACHER_GYAN_REWARD_CONFIG_KEY),
    DEFAULT_TEACHER_RDM_COSTS.gyan_teacher_answer
  );
  return out;
}

export async function fetchTeacherRdmCosts(client?: unknown): Promise<TeacherRdmCosts> {
  const db = (client ?? supabase) as RdmConfigClient;
  try {
    const { data, error } = await db
      .from("rdm_config")
      .select("key, value")
      .in("key", [...ALL_TEACHER_RDM_CONFIG_KEYS]);
    if (error || !data?.length) return DEFAULT_TEACHER_RDM_COSTS;
    return teacherRdmCostsFromRows(data as Array<{ key: string; value: number | null }>);
  } catch {
    return DEFAULT_TEACHER_RDM_COSTS;
  }
}

export function getChargeAmountForAction(
  costs: TeacherRdmCosts,
  action: TeacherRdmChargeAction
): number {
  return costs[action];
}

/** Admin UI metadata for the Teachers RDM section. */
export const TEACHER_RDM_ADMIN_META: Record<
  string,
  { title: string; kind: "charge" | "reward"; teacherSurface: string; serverPath?: string }
> = {
  teacher_create_classroom_rdm: {
    title: "Create classroom",
    kind: "charge",
    teacherSurface: "My Classroom · Create / Launch classroom",
    serverPath: "POST /api/teacher/rdm/charge (create_classroom)",
  },
  teacher_create_section_rdm: {
    title: "Create section (per section, max 6 per class)",
    kind: "charge",
    teacherSurface: "My Classroom · Add section",
    serverPath: "POST /api/teacher/rdm/charge (create_section)",
  },
  teacher_create_assignment_rdm: {
    title: "Publish assignment",
    kind: "charge",
    teacherSurface: "Task wizard · Create assignment · Publish",
    serverPath: "POST /api/teacher/rdm/charge (create_assignment)",
  },
  teacher_schedule_session_rdm: {
    title: "Schedule live lesson / webinar",
    kind: "charge",
    teacherSurface: "My lessons · Schedule class",
    serverPath: "POST /api/teacher/rdm/charge (schedule_session)",
  },
  teacher_generate_test_rdm: {
    title: "Generate new MCQ test (first time only)",
    kind: "charge",
    teacherSurface: "Create Tests · Generate Test Now (history reprints are free)",
    serverPath: "POST /api/teacher/rdm/charge (generate_test)",
  },
  [TEACHER_GYAN_REWARD_CONFIG_KEY]: {
    title: "Gyan++ wall · Teacher section / comment",
    kind: "reward",
    teacherSurface: "Gyan++ Wall · Post Teacher Section",
    serverPath: "doubt_answer_daily_rdm_trigger (IST daily COMMENT milestone)",
  },
};

export const TEACHER_RDM_ADMIN_CHARGE_KEYS = Object.values(TEACHER_RDM_CHARGE_CONFIG_KEYS);
export const TEACHER_RDM_ADMIN_REWARD_KEYS = [TEACHER_GYAN_REWARD_CONFIG_KEY] as const;
