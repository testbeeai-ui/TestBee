/**
 * Whitelist still gates access. It must not stamp teacher onto a
 * brand-new or wiped Google user during Welcome back.
 */
export function shouldApplyWhitelistRoleToProfile(isSignIn: boolean): boolean {
  return isSignIn !== true;
}
