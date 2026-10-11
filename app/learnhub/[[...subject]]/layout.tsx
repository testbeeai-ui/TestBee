import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LEARN_HUB_SUBJECT_TITLE, parseLearnHubSubjectSlug } from "@/lib/learnhub/routes";

export const dynamic = "force-dynamic";

type LearnHubParams = Promise<{ subject?: string[] }>;

export async function generateMetadata({ params }: { params: LearnHubParams }): Promise<Metadata> {
  const { subject: segments } = await params;
  const subject = parseLearnHubSubjectSlug(segments?.[0]);
  return { title: subject ? `${LEARN_HUB_SUBJECT_TITLE[subject]} · Learn Hub` : "Learn Hub" };
}

export default async function LearnHubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: LearnHubParams;
}) {
  const { subject: segments } = await params;
  if (segments && (segments.length > 1 || !parseLearnHubSubjectSlug(segments[0]))) notFound();
  return children;
}
