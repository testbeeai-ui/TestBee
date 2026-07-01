import { useLocalSearchParams } from "expo-router";
import { EduFundDetailScreen } from "@/features/edufund/screens/EduFundDetailScreen";

export default function EduFundDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EduFundDetailScreen proposalId={id ?? ""} />;
}
