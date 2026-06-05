export type EmailDayStats = {
  istDate: string;
  label: string;
  sent: number;
  failed: number;
  blockedCap: number;
  welcome: number;
  login: number;
};

export type AdminEmailOverview = {
  cap: number;
  today: EmailDayStats;
  yesterday: EmailDayStats;
  last7Days: EmailDayStats[];
  totals: { sent: number; failed: number; blockedCap: number };
  welcomeFlow: {
    enabled: boolean;
    note: string;
  };
};
