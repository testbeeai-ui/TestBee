import { redirect } from "next/navigation";
import { intelligenceReportHref } from "@/lib/admin/intelligenceReports";

export default function ErrorTrackingRedirectPage() {
  redirect(intelligenceReportHref("error-tracking"));
}
