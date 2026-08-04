import { FileText } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function DocumentsPage() {
  return (
    <ComingSoon
      title="Documents"
      icon={FileText}
      description="La bibliothèque complète arrive bientôt. Pour l'instant, retrouve tes derniers scans sur l'accueil."
    />
  );
}
