import { describe, expect, it } from "vitest";
import { resolveTsconfigPath } from "./nextBuildPaths";

describe("resolveTsconfigPath", () => {
  it("typechecks the app without test files during production build", () => {
    expect(resolveTsconfigPath(["next", "build"], undefined)).toBe("tsconfig.build.json");
    expect(resolveTsconfigPath(["next"], "phase-production-build")).toBe("tsconfig.build.json");
  });

  it("leaves dev on the editor tsconfig", () => {
    expect(resolveTsconfigPath(["next", "dev"], undefined)).toBe("tsconfig.json");
  });
});
