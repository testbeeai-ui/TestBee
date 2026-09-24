const PRODUCTION_BUILD_PHASE = "phase-production-build";

export function isProductionBuild(argv: readonly string[], phase: string | undefined): boolean {
  return phase === PRODUCTION_BUILD_PHASE || argv.includes("build");
}

/**
 * Production typecheck skips test files.
 * Dev and the editor stay on tsconfig.json.
 * Dist stays `.next`: Next 16 already isolates `next dev` from `next build`,
 * and a custom distDir makes Turbopack fail with a missing app-paths manifest.
 */
export function resolveTsconfigPath(argv: readonly string[], phase: string | undefined): string {
  return isProductionBuild(argv, phase) ? "tsconfig.build.json" : "tsconfig.json";
}

