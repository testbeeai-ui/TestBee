import { redirect } from "next/navigation";
import { intelligenceReportHref } from "@/lib/admin/intelligenceReports";

export default function RetentionCohortsRedirectPage() {
  redirect(intelligenceReportHref("retention-cohorts"));
}
