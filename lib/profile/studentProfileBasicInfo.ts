import type { Profile } from "@/hooks/useAuth";

function hasText(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/** Required “Basic information” fields (matches StudentProfilePersonalHub savePersonal). */
export function isStudentProfileBasicInfoComplete(
  profile: Profile,
  accountEmail?: string | null
): boolean {
  if (!hasText(profile.first_name)) return false;
  if (!hasText(profile.last_name)) return false;
  if (!hasText(profile.state)) return false;
  if (!hasText(profile.city)) return false;
  if ((profile.phone ?? "").replace(/\D/g, "").length !== 10) return false;
  if (!hasText(profile.gender)) return false;
  if (!hasText(accountEmail)) return false;
  return true;
}
