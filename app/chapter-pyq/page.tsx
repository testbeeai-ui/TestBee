import { Suspense } from "react";
import AppLayout from "@/components/AppLayout";
import ChapterPyqListView from "@/components/chapter-pyq/ChapterPyqListView";

export const dynamic = "force-dynamic";

export default function ChapterPyqPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh]" />}>
      <AppLayout wideMain>
        <ChapterPyqListView />
      </AppLayout>
    </Suspense>
  );
}
