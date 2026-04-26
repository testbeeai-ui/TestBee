import { redirect } from "next/navigation";

/** Legacy URL: all entry is unified at `/auth`. */
export default function AuthChoiceRedirectPage() {
  redirect("/auth");
}
