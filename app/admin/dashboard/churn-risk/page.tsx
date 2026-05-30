import { redirect } from "next/navigation";
import { intelligenceReportHref } from "@/lib/admin/intelligenceReports";

export default function ChurnRiskRedirectPage() {
  redirect(intelligenceReportHref("churn-risk"));
}
