import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { AssignmentTaskStored } from "@/lib/classroom/assignmentTasks";
import { ensureError, randomJoinCode, type DbClient } from "./utils";

export async function fetchAllPostsForTeacherClassrooms(
  db: DbClient,
  teacherId: string,
  classroomIds: string[]
): Promise<
  Array<{
    id: string;
    classroom_id: string;
    section_id: string | null;
    type: string;
    title: string;
    description: string | null;
    due_date: string | null;
    content_json: Json | null;
    created_at: string;
    updated_at: string;
    teacher_id: string;
  }>
> {
  if (classroomIds.length === 0) return [];
  const columns =
    "id, classroom_id, section_id, type, title, description, due_date, content_json, created_at, updated_at, teacher_id";
  type PostRow = {
    id: string;
    classroom_id: string;
    section_id: string | null;
    type: string;
    title: string;
    description: string | null;
    due_date: string | null;
    content_json: Json | null;
    created_at: string;
    updated_at: string;
    teacher_id: string;
  };
  const all: PostRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db
      .from("posts")
      .select(columns)
      .eq("teacher_id", teacherId)
      .in("classroom_id", classroomIds)
      .order("created_at", { ascending: false })
      .range(offset, offset + 1000 - 1);
    if (error) throw ensureError(error);
    const chunk = (data ?? []) as PostRow[];
    all.push(...chunk);
    if (chunk.length < 1000) break;
  }
  return all;
}

export function countStudentsAllVisibleTasksDone(
  studentUserIds: string[],
  visibleTasks: AssignmentTaskStored[],
  progressForPost: Array<{ task_id: string; user_id: string }>
): number {
  if (visibleTasks.length === 0 || studentUserIds.length === 0) return 0;
  return studentUserIds.filter((uid) =>
    visibleTasks.every((task) =>
      progressForPost.some((r) => r.user_id === uid && r.task_id === task.id)
    )
  ).length;
}

/** 6-char codes for student join; avoids collisions with a few retries. */
export async function allocateUniqueJoinCode(db: DbClient = supabase): Promise<string> {
  for (let attempt = 0; attempt < 16; attempt++) {
    const code = randomJoinCode();
    const { data, error } = await db
      .from("classrooms")
      .select("id")
      .eq("join_code", code)
      .maybeSingle();
    if (error) continue;
    if (!data) return code;
  }
  throw new Error("Could not allocate a unique join code.");
}

/** Optional comma-separated classroom UUIDs (NEXT_PUBLIC_TEACHER_PORTAL_DEMO_CLASSROOM_IDS). */
function teacherPortalDemoClassroomIdsFromEnv(): string[] {
  const raw =
    typeof process !== "undefined" &&
    typeof process.env?.NEXT_PUBLIC_TEACHER_PORTAL_DEMO_CLASSROOM_IDS === "string"
      ? process.env.NEXT_PUBLIC_TEACHER_PORTAL_DEMO_CLASSROOM_IDS
      : "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** One designated "showcase" class keeps demo roster/banners; all other classes use real members only. */
export function isTeacherPortalDemoShowcaseClassroom(
  classroomId: string,
  classroomName: string | null
): boolean {
  if (teacherPortalDemoClassroomIdsFromEnv().includes(classroomId)) return true;
  return (classroomName ?? "").trim().toLowerCase() === "demo";
}
