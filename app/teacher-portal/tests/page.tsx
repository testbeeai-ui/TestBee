"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TeacherPortalTestsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/teacher-portal?section=createTests");
  }, [router]);

  return null;
}
