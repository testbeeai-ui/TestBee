import { redirect } from "next/navigation";
import { intelligenceReportHref } from "@/lib/admin/intelligenceReports";

export default function FeatureAdoptionRedirectPage() {
  redirect(intelligenceReportHref("feature-adoption"));
}
