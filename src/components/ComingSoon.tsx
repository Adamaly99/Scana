import type { LucideIcon } from "lucide-react";

interface ComingSoonProps {
  title: string;
  icon: LucideIcon;
  description: string;
}

export default function ComingSoon({ title, icon: Icon, description }: ComingSoonProps) {
  return (
    <div className="flex h-full min-h-full flex-col">
      <header className="border-b border-line bg-card px-5 py-4">
        <h1 className="text-lg font-bold text-ink">{title}</h1>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-raised">
          <Icon size={26} className="text-ink-dim" />
        </div>
        <p className="font-semibold text-ink">Bientôt disponible</p>
        <p className="text-sm text-ink-dim">{description}</p>
      </div>
    </div>
  );
}
