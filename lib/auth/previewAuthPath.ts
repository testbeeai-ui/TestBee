/** Secret preview / whitelist sign-in entry (production path). */
export const PREVIEW_AUTH_PATH = "/preview-raknas-amu";

/** Older obfuscated paths — redirect in middleware only. */
export const PREVIEW_AUTH_LEGACY_PATHS = [
  "/preview-1006",
  "/preview-1006-raknas-amu-tsalbude",
] as const;

/** @deprecated Use PREVIEW_AUTH_LEGACY_PATHS */
export const PREVIEW_AUTH_LEGACY_PATH = "/preview-1006";
