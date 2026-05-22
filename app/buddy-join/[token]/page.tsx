import { Suspense } from "react";
import BuddyJoinClient from "./BuddyJoinClient";

export default async function BuddyJoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <span className="text-4xl animate-pulse">🤝</span>
        </div>
      }
    >
      <BuddyJoinClient token={token} />
    </Suspense>
  );
}
