export type StudentNotification = {
  id: string;
  title: string;
  preview: string;
  body: string;
  createdAt: string;
  actionPath: string | null;
  rdmDelta?: number;
};
