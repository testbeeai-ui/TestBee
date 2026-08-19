export type SignupClassLevel = 11 | 12;

export type SignupFormInput = {
  classLevel: SignupClassLevel | null | undefined;
  college: string | null | undefined;
  institutionAck: boolean;
  state: string | null | undefined;
  city: string | null | undefined;
};

export function isSignupClassCollegeReady(
  classLevel: SignupClassLevel | null | undefined,
  college: string | null | undefined,
): boolean {
  if (classLevel !== 11 && classLevel !== 12) return false;
  return (college ?? "").trim().length >= 2;
}

export function isSignupLocationReady(
  state: string | null | undefined,
  city: string | null | undefined,
): boolean {
  return (state ?? "").trim().length > 0 && (city ?? "").trim().length > 0;
}

export function isSignupProfileReady(input: SignupFormInput): boolean {
  return (
    isSignupClassCollegeReady(input.classLevel, input.college) &&
    input.institutionAck === true &&
    isSignupLocationReady(input.state, input.city)
  );
}

export const EDUDECA_REGISTRATION_SUCCESS_TITLE = "You're on the list";

export const EDUDECA_REGISTRATION_SUCCESS_MESSAGE =
  "Competition shall open by mid September. An invitation will be sent before they start.";
