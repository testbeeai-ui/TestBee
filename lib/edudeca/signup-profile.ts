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
  "Notification will be sent once the app is open for use. An invitation will be sent before they start.";

export const EDUDECA_EDUBITE_PRACTICE_APP_URL =
  "https://expo.dev/accounts/edublast/projects/edubite-mobile/builds/7c5b40f7-1c10-4cbe-9893-e1cf4a61f171";

export const EDUDECA_REGISTRATION_SUCCESS_WAIT_BEFORE = "While you wait, ";

export const EDUDECA_EDUBITE_PRACTICE_LINK_LABEL = "download the Edubite app";

export const EDUDECA_REGISTRATION_SUCCESS_WAIT_AFTER =
  " to practice for now. A Play Store QR will be shared later.";

export const EDUDECA_REGISTRATION_SUCCESS_WAIT_MESSAGE = `${EDUDECA_REGISTRATION_SUCCESS_WAIT_BEFORE}${EDUDECA_EDUBITE_PRACTICE_LINK_LABEL}${EDUDECA_REGISTRATION_SUCCESS_WAIT_AFTER}`;
