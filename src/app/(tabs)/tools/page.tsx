import { Wrench } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function ToolsPage() {
  return (
    <ComingSoon
      title="Outils"
      icon={Wrench}
      description="Recadrage manuel, OCR, signature et compression arrivent dans une prochaine étape."
    />
  );
}
