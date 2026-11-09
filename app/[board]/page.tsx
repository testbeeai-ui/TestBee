import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import AppLayout from "@/components/AppLayout";
import ChapterPyqListView from "@/components/chapter-pyq/ChapterPyqListView";
import { LearnHubAtName } from "@/app/learnhub/[[...subject]]/ExploreClient";
import { createAdminClient } from "@/integrations/supabase/server";
import { parseLearnHubSubjectSlug } from "@/lib/learnhub/routes";
import {
  isNamedLinkDestination,
  isNamedLinkSubject,
  isReservedNamedSlug,
  namedSlugError,
} from "@/lib/named-links/slug";

export const dynamic = "force-dynamic";

/**
 * A promotion name such as /mrphani. The address stays that name.
 * Static routes (home, learnhub, chapter-pyq, …) win over this.
 */
export default async function NamedLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ board: string }>;
  searchParams: Promise<{ subject?: string }>;
}) {
  const { board } = await params;
  const query = await searchParams;
  const subjectFromQuery = parseLearnHubSubjectSlug(query.subject);
  const slug = board.trim().toLowerCase();
  if (namedSlugError(slug) || isReservedNamedSlug(slug)) notFound();

  const admin = createAdminClient();
  if (!admin) notFound();

  const db = admin as unknown as SupabaseClient;
  const { data } = await db
    .from("named_page_links")
    .select("destination, subject")
    .eq("slug", slug)
    .maybeSingle();

  const destination = typeof data?.destination === "string" ? data.destination : "";
  const subject = typeof data?.subject === "string" ? data.subject : null;
  if (!isNamedLinkDestination(destination)) notFound();

  if (destination === "learnhub") {
    if (!isNamedLinkSubject(subject)) notFound();
    return <LearnHubAtName subject={subject} />;
  }

  return (
    <Suspense fallback={<div className="min-h-[40vh]" />}>
      <AppLayout wideMain>
        <ChapterPyqListView
          initialSubject={
            isNamedLinkSubject(subjectFromQuery)
              ? subjectFromQuery
              : isNamedLinkSubject(subject)
                ? subject
                : null
          }
          keepAddress
        />
      </AppLayout>
    </Suspense>
  );
}
