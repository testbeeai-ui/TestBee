import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrialOnboardingAnswers } from "@/components/dashboard/free-trial-onboarding/types";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createClientWithToken: vi.fn(),
  createAdminClient: vi.fn(),
  fetchRdmConfig: vi.fn(),
}));

vi.mock("@/integrations/supabase/server", () => ({
  createClient: mocks.createClient,
  createClientWithToken: mocks.createClientWithToken,
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/rdm/rdmConfig", () => ({
  fetchRdmConfig: mocks.fetchRdmConfig,
}));

const user = { id: "00000000-0000-0000-0000-000000000123" };

const validAnswers: TrialOnboardingAnswers = {
  classLevel: "Class 12",
  board: "CBSE",
  boardCustom: "",
  objective: "Engineering entrance",
  boardExam: null,
  boardExamCustom: "",
  engExams: ["JEE Main"],
  medExams: [],
  primaryPlatform: "Self-study",
  schoolName: "",
  secondaryPlatforms: [],
  otherEdtechPlatformName: "",
  studyHours: "1-2 hours",
  usedAi: true,
  usedSocMed: false,
  wantsGamification: true,
};

function makeRequest() {
  return new Request("https://app.test/api/user/subscription/activate-trial", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "app.test",
      origin: "https://app.test",
      "x-forwarded-proto": "https",
    },
    body: JSON.stringify({ answers: validAnswers }),
  });
}

function makeSupabaseMock(opts: {
  initialProfile: { free_trial_activated: boolean | null; free_trial_activated_at: string | null };
  activationResult?: { free_trial_activated_at: string | null } | null;
  concurrentProfile?: { free_trial_activated_at: string | null };
}) {
  const update = vi.fn((payload: Record<string, unknown>) => ({
    eq: vi.fn(() => ({
      or: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: opts.activationResult ?? null,
            error: null,
          })),
        })),
      })),
    })),
    payload,
  }));

  const readResponses = [
    {
      data: opts.initialProfile,
      error: null,
    },
    {
      data: opts.concurrentProfile ?? null,
      error: null,
    },
  ];
  const select = vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: vi.fn(async () => readResponses.shift() ?? { data: null, error: null }),
    })),
  }));

  const supabase = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user } })),
    },
    from: vi.fn((table: string) => {
      expect(table).toBe("profiles");
      return { select, update };
    }),
  };

  return { supabase, select, update };
}

describe("activate-trial route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchRdmConfig.mockResolvedValue({ free_trial_welcome_rdm: 500 });
  });

  it("does not reset checklist progress or credit RDM when trial is already active", async () => {
    const admin = { rpc: vi.fn() };
    const { supabase, update } = makeSupabaseMock({
      initialProfile: {
        free_trial_activated: true,
        free_trial_activated_at: "2026-06-01T10:00:00.000Z",
      },
    });
    mocks.createClient.mockResolvedValue(supabase);
    mocks.createAdminClient.mockReturnValue(admin);

    const { POST } = await import("@/app/api/user/subscription/activate-trial/route");
    const res = await POST(makeRequest());
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      alreadyActivated: true,
      free_trial_activated_at: "2026-06-01T10:00:00.000Z",
    });
    expect(update).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("credits welcome RDM only after the guarded first activation update wins", async () => {
    const admin = { rpc: vi.fn(async () => ({ error: null })) };
    const { supabase, update } = makeSupabaseMock({
      initialProfile: {
        free_trial_activated: false,
        free_trial_activated_at: null,
      },
      activationResult: { free_trial_activated_at: "2026-06-02T11:00:00.000Z" },
    });
    mocks.createClient.mockResolvedValue(supabase);
    mocks.createAdminClient.mockReturnValue(admin);

    const { POST } = await import("@/app/api/user/subscription/activate-trial/route");
    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        free_trial_activated: true,
        onboarding_reward_progress: {},
        onboarding_reward_claimed_at: null,
      })
    );
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    expect(admin.rpc).toHaveBeenCalledWith("add_rdm", { uid: user.id, amt: 500 });
  });

  it("does not credit welcome RDM when a concurrent activation already updated the row", async () => {
    const admin = { rpc: vi.fn() };
    const { supabase } = makeSupabaseMock({
      initialProfile: {
        free_trial_activated: false,
        free_trial_activated_at: null,
      },
      activationResult: null,
      concurrentProfile: { free_trial_activated_at: "2026-06-02T11:00:01.000Z" },
    });
    mocks.createClient.mockResolvedValue(supabase);
    mocks.createAdminClient.mockReturnValue(admin);

    const { POST } = await import("@/app/api/user/subscription/activate-trial/route");
    const res = await POST(makeRequest());
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      alreadyActivated: true,
      free_trial_activated_at: "2026-06-02T11:00:01.000Z",
    });
    expect(admin.rpc).not.toHaveBeenCalled();
  });
});
