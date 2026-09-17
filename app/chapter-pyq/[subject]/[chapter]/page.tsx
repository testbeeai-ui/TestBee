import { Suspense } from "react";
import AppLayout from "@/components/AppLayout";
import ChapterPyqPracticeView from "@/components/chapter-pyq/ChapterPyqPracticeView";

export const dynamic = "force-dynamic";

export default async function ChapterPyqPracticePage({
  params,
}: {
  params: Promise<{ subject: string; chapter: string }>;
}) {
  const { subject, chapter } = await params;

  return (
    <Suspense fallback={<div className="min-h-[40vh]" />}>
      <AppLayout>
        <ChapterPyqPracticeView subject={subject} chapter={chapter} />
      </AppLayout>
    </Suspense>
  );
}
