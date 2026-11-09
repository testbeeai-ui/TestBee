/**
 * Welcome back must not stamp a leftover whitelist role onto the profile.
 * Launch sign-in lets the person choose Student or Teacher in onboarding.
 */
export function shouldApplyWhitelistRoleToProfile(isSignIn: boolean): boolean {
  return isSignIn !== true;
}
