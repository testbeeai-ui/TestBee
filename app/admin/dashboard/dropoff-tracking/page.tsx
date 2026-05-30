import { redirect } from "next/navigation";
import { intelligenceReportHref } from "@/lib/admin/intelligenceReports";

export default function DropoffTrackingRedirectPage() {
  redirect(intelligenceReportHref("dropoff-tracking"));
}
