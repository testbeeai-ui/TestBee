export type WalletGuideRow = {
  label: string;
  value: string;
};

export type WalletGuide = {
  earn: WalletGuideRow[];
  spend: WalletGuideRow[];
  notes: string[];
};
