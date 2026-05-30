export type SarvamLimitsSnapshot = {
  model: string;
  globalOutputCap: number;
  profPiRequestedMax: number;
  profPiEffectiveMax: number;
  ragContextMaxChars: number;
  systemPromptMaxChars: number;
  userContentMaxChars: number;
  env: {
    SARVAM_MAX_OUTPUT_TOKENS?: string;
    SARVAM_PROF_PI_MAX_TOKENS?: string;
    SARVAM_GYAN_MODEL?: string;
    SARVAM_MODEL?: string;
    RAG_FORMATTED_CONTEXT_MAX_CHARS?: string;
  };
};

export type SarvamProbeRow = {
  requested: number;
  appResolved: number;
  httpStatus: number | null;
  latencyMs: number;
  ok: boolean;
  error?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export type SarvamProbeResult = {
  note: string;
  recommendedMaxTokens: number | null;
  rows: SarvamProbeRow[];
};
