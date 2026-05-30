import { redirect } from "next/navigation";
import { intelligenceReportHref } from "@/lib/admin/intelligenceReports";

export default function ConversionFunnelRedirectPage() {
  redirect(intelligenceReportHref("conversion-funnel"));
}
