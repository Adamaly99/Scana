import type { ReactNode } from "react";
import BottomNav from "@/components/BottomNav";

export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col">
      <div className="flex-1 overflow-y-auto">{children}</div>
      <BottomNav />
    </div>
  );
}
