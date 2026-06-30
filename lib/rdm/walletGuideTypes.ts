export type WalletGuideRow = {
  label: string;
  /** e.g. "+100", "−30", "+100 +10/student" */
  value: string;
};

export type WalletGuide = {
  earn: WalletGuideRow[];
  spend: WalletGuideRow[];
  notes: string[];
};
