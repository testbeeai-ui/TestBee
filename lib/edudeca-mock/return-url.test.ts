import { describe, expect, it } from "vitest";

import {
  LIVE_EDUDECA_APP_URL,
  edudecaAppOrigin,
  edudecaMockLoginRedirect,
  edudecaMockPaperPath,
  edudecaMockFinishReturnUrl,
  edudecaMockReturnUrl,
} from "./return-url";

describe("edudecaMockReturnUrl", () => {
  it("sends completed score back to EduDeca mock-test", () => {
    expect(
      edudecaMockReturnUrl(
        {
          level: 2,
          set: 1,
          status: "completed",
          scorePct: 80,
          correct: 16,
          total: 20,
        },
        "http://localhost:3001",
      ),
    ).toBe(
      "http://localhost:3001/mock-test?level=2&set=1&score=80&correct=16&total=20&status=completed",
    );
  });

  it("keeps level and set on the EduBlast mock path", () => {
    expect(edudecaMockPaperPath(1, 1)).toBe("/edudeca-mock?level=1&set=1");
  });

  it("sends unsigned students back to that path after login", () => {
    expect(edudecaMockLoginRedirect(1, 1)).toBe(
      "/?next=%2Fedudeca-mock%3Flevel%3D1%26set%3D1",
    );
  });

  it("can return in-progress without a score", () => {
    expect(
      edudecaMockReturnUrl(
        { level: 1, set: 4, status: "inprogress" },
        "https://edu-deca.vercel.app/",
      ),
    ).toBe("https://edu-deca.vercel.app/mock-test?level=1&set=4&status=inprogress");
  });

  it("only marks the paper completed after the server grades it", () => {
    expect(
      edudecaMockFinishReturnUrl({
        level: 2,
        set: 6,
        serverScore: null,
      }),
    ).toBe("http://localhost:3001/mock-test?level=2&set=6&status=inprogress");
    expect(
      edudecaMockFinishReturnUrl({
        level: 2,
        set: 6,
        serverScore: { correct: 16, total: 20, scorePct: 80 },
      }),
    ).toBe(
      "http://localhost:3001/mock-test?level=2&set=6&score=80&correct=16&total=20&status=completed",
    );
  });
});

describe("edudecaAppOrigin", () => {
  it("keeps localhost EduDeca only when this page is also local", () => {
    expect(edudecaAppOrigin("http://localhost:3001", "localhost")).toBe("http://localhost:3001");
    expect(edudecaAppOrigin("http://127.0.0.1:3001", "127.0.0.1")).toBe("http://127.0.0.1:3001");
  });

  it("does not send a public EduBlast page back to localhost EduDeca", () => {
    expect(edudecaAppOrigin("http://localhost:3001", "www.edublast.in")).toBe(LIVE_EDUDECA_APP_URL);
    expect(edudecaAppOrigin("http://localhost:3001", "edublast.vercel.app")).toBe(
      LIVE_EDUDECA_APP_URL,
    );
  });

  it("keeps an already-public EduDeca origin", () => {
    expect(edudecaAppOrigin("https://edu-deca.vercel.app/", "www.edublast.in")).toBe(
      "https://edu-deca.vercel.app",
    );
  });
});
