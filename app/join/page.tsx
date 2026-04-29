import { Suspense } from "react";
import JoinByCodeClient from "./JoinByCodeClient";

export default function JoinByCodePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <span className="text-4xl animate-pulse">📚</span>
        </div>
      }
    >
      <JoinByCodeClient />
    </Suspense>
  );
}

