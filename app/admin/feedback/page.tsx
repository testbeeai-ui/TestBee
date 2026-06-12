"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { MessageSquare, ClipboardList, ShieldCheck, Trophy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeedbackTab } from "./FeedbackTab";
import { WaitlistTab } from "./WaitlistTab";
import { ApprovedEmailsTab } from "./ApprovedEmailsTab";

export default function AdminFeedbackPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Determine active tab from URL query params (default to "feedback")
  const tParam = searchParams.get("tab");
  const urlTab =
    tParam === "waitlist"
      ? "waitlist"
      : tParam === "ambassador"
      ? "ambassador"
      : tParam === "approved"
      ? "approved"
      : "feedback";
  const [activeTab, setActiveTab] = useState<"feedback" | "waitlist" | "ambassador" | "approved">(urlTab);

  // Sync state if URL changes
  useEffect(() => {
    setActiveTab(urlTab);
  }, [urlTab]);

  const handleTabChange = (value: string) => {
    const nextTab = value as "feedback" | "waitlist" | "ambassador" | "approved";
    setActiveTab(nextTab);

    // Update URL query parameters without full reload
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    // Clear deep link ID when switching tabs to avoid showing incorrect selected item
    params.delete("id");
    
    router.replace(`${pathname}?${params.toString()}`);
  };

  const currentId = searchParams.get("id");

  return (
    <div className="space-y-6">
      {/* Tab Control */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="flex items-center justify-between border-b pb-3 mb-2">
          <div>
            <h2 className="text-xl font-bold tracking-tight">F&W Inbox</h2>
            <p className="text-xs text-muted-foreground">Manage waitlist registrations, approved signups, and 'Share your experience' settings feedback.</p>
          </div>
          <TabsList className="grid w-[600px] grid-cols-4">
            <TabsTrigger value="feedback" className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Feedback
            </TabsTrigger>
            <TabsTrigger value="waitlist" className="flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" />
              Waitlist
            </TabsTrigger>
            <TabsTrigger value="ambassador" className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5" />
              Ambassadors
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Approved Emails
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="feedback" className="mt-0 focus-visible:outline-none animate-in fade-in duration-200">
          <FeedbackTab initialId={activeTab === "feedback" ? currentId : null} />
        </TabsContent>

        <TabsContent value="waitlist" className="mt-0 focus-visible:outline-none animate-in fade-in duration-200">
          <WaitlistTab tier="waitlist" initialId={activeTab === "waitlist" ? currentId : null} />
        </TabsContent>

        <TabsContent value="ambassador" className="mt-0 focus-visible:outline-none animate-in fade-in duration-200">
          <WaitlistTab tier="ambassador" initialId={activeTab === "ambassador" ? currentId : null} />
        </TabsContent>

        <TabsContent value="approved" className="mt-0 focus-visible:outline-none animate-in fade-in duration-200">
          <ApprovedEmailsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
