import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrialOnboardingAnswers } from "@/components/dashboard/free-trial-onboarding/types";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createClientWithToken: vi.fn(),
  createAdminClient: vi.fn(),
  enforceSameOriginForCookieAuth: vi.fn(),
  fetchRdmConfig: vi.fn(),
}));

vi.mock("@/integrations/supabase/server", () => ({
  createClient: mocks.createClient,
  createClientWithToken: mocks.createClientWithToken,
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/auth/securityGuards", () => ({
  enforceSameOriginForCookieAuth: mocks.enforceSameOriginForCookieAuth,
}));

vi.mock("@/lib/rdm/rdmConfig", () => ({
  fetchRdmConfig: mocks.fetchRdmConfig,
}));

import { POST } from "@/app/api/user/subscription/activate-trial/route";

const user = { id: "user-1" };
const validAnswers: TrialOnboardingAnswers = {
  classLevel: "Class 11",
  board: "CBSE",
  boardCustom: "",
  objective: "Clear Board Exams",
  boardExam: "CBSE Board",
  boardExamCustom: "",
  engExams: [],
  medExams: [],
  primaryPlatform: "Self-study",
  schoolName: "",
  secondaryPlatforms: [],
  otherEdtechPlatformName: "",
  studyHours: "1-2 hours",
  usedAi: false,
  usedSocMed: false,
  wantsGamification: true,
};

function makeRequest() {
  return new Request("https://testbee.local/api/user/subscription/activate-trial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers: validAnswers }),
  });
}

function makeQuery(result: unknown) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
  };
  return query;
}

function makeSupabase(opts: {
  selectResults: unknown[];
  updateResult?: unknown;
  updatePayloads?: unknown[];
}) {
  const updatePayloads = opts.updatePayloads ?? [];
  const selectResults = [...opts.selectResults];
  const update = vi.fn((payload: unknown) => {
    updatePayloads.push(payload);
    return makeQuery(opts.updateResult ?? { data: null, error: null });
  });
  const from = vi.fn(() => ({
    select: vi.fn(() => makeQuery(selectResults.shift() ?? { data: null, error: null })),
    update,
  }));

  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user } })),
    },
    from,
    update,
    updatePayloads,
  };
}

describe("activate-trial route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceSameOriginForCookieAuth.mockReturnValue(null);
    mocks.fetchRdmConfig.mockResolvedValue({ free_trial_welcome_rdm: 500 });
  });

  it("does not reset checklist state or credit RDM when the trial is already active", async () => {
    const supabase = makeSupabase({
      selectResults: [
        {
          data: {
            free_trial_activated: true,
            free_trial_activated_at: "2026-06-01T00:00:00.000Z",
          },
          error: null,
        },
      ],
    });
    const admin = { rpc: vi.fn() };
    mocks.createClient.mockResolvedValue(supabase);
    mocks.createAdminClient.mockReturnValue(admin);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      alreadyActivated: true,
      free_trial_activated_at: "2026-06-01T00:00:00.000Z",
    });
    expect(supabase.update).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("treats a lost conditional update as already activated and skips welcome credit", async () => {
    const updatePayloads: unknown[] = [];
    const supabase = makeSupabase({
      selectResults: [
        { data: { free_trial_activated: false, free_trial_activated_at: null }, error: null },
        {
          data: { free_trial_activated_at: "2026-06-01T00:00:01.000Z" },
          error: null,
        },
      ],
      updateResult: { data: null, error: null },
      updatePayloads,
    });
    const admin = { rpc: vi.fn() };
    mocks.createClient.mockResolvedValue(supabase);
    mocks.createAdminClient.mockReturnValue(admin);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.alreadyActivated).toBe(true);
    expect(updatePayloads).toHaveLength(1);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("credits welcome RDM exactly once after winning the guarded first activation", async () => {
    const updatePayloads: unknown[] = [];
    const supabase = makeSupabase({
      selectResults: [
        { data: { free_trial_activated: false, free_trial_activated_at: null }, error: null },
      ],
      updateResult: {
        data: { free_trial_activated_at: "2026-06-01T00:00:02.000Z" },
        error: null,
      },
      updatePayloads,
    });
    const admin = { rpc: vi.fn(async () => ({ error: null })) };
    mocks.createClient.mockResolvedValue(supabase);
    mocks.createAdminClient.mockReturnValue(admin);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true });
    expect(body.alreadyActivated).toBeUndefined();
    expect(updatePayloads).toHaveLength(1);
    expect(updatePayloads[0]).toMatchObject({
      free_trial_activated: true,
      onboarding_reward_progress: {},
      onboarding_reward_claimed_at: null,
    });
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    expect(admin.rpc).toHaveBeenCalledWith("add_rdm", { uid: user.id, amt: 500 });
  });
});
