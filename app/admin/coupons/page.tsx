"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Ticket, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TeacherCouponsTab } from "./TeacherCouponsTab";
import { StudentCouponsTab } from "./StudentCouponsTab";

export default function AdminCouponsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Determine active tab from URL query params (default to "teacher")
  const urlTab = searchParams.get("tab") === "student" ? "student" : "teacher";
  const [activeTab, setActiveTab] = useState<"teacher" | "student">(urlTab);

  // Sync state if URL changes
  useEffect(() => {
    setActiveTab(urlTab);
  }, [urlTab]);

  const handleTabChange = (value: string) => {
    const nextTab = value as "teacher" | "student";
    setActiveTab(nextTab);

    // Update URL query parameters without full reload
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <main className="p-4 md:p-6 space-y-6">
      {/* Top Header & Page Title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl flex items-center gap-2">
          <Ticket className="h-6 w-6 text-primary" />
          Coupon Codes Manager
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage promotional discount codes and track purchased credits for teachers and students.
        </p>
      </div>

      {/* Tab Control */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="border-b pb-3 mb-4">
          <TabsList className="grid w-[300px] grid-cols-2">
            <TabsTrigger value="teacher" className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Teacher Coupons
            </TabsTrigger>
            <TabsTrigger value="student" className="flex items-center gap-1.5">
              <Ticket className="h-3.5 w-3.5" />
              Student Coupons
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="teacher" className="mt-0 focus-visible:outline-none animate-in fade-in duration-200">
          <TeacherCouponsTab />
        </TabsContent>

        <TabsContent value="student" className="mt-0 focus-visible:outline-none animate-in fade-in duration-200">
          <StudentCouponsTab />
        </TabsContent>
      </Tabs>
    </main>
  );
}
