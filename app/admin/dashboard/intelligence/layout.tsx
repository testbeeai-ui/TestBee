import { IntelligenceHubNav } from "@/components/admin/IntelligenceHubNav";

export default function IntelligenceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <IntelligenceHubNav />
      {children}
    </div>
  );
}
