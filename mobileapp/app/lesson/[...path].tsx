import { useLocalSearchParams } from "expo-router";
import { LessonPlayerScreen } from "@/features/lessons/screens/LessonPlayerScreen";

export default function LessonRoute() {
  const { path } = useLocalSearchParams<{ path: string | string[] }>();
  const segments = Array.isArray(path) ? path : path ? [path] : [];
  return <LessonPlayerScreen pathSegments={segments} />;
}
