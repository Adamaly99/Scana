"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FileText, Camera, Wrench, User, type LucideIcon } from "lucide-react";

interface TabDef {
  href: string;
  label: string;
  icon: LucideIcon;
}

const LEFT_TABS: TabDef[] = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/documents", label: "Documents", icon: FileText },
];

const RIGHT_TABS: TabDef[] = [
  { href: "/tools", label: "Outils", icon: Wrench },
  { href: "/profile", label: "Profil", icon: User },
];

function TabLink({ href, label, icon: Icon, active }: TabDef & { active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex w-16 flex-col items-center gap-1 py-1 ${
        active ? "text-accent" : "text-ink-dim"
      }`}
    >
      <Icon size={22} />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-40 border-t border-line bg-card px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
      <div className="flex items-center justify-between">
        {LEFT_TABS.map((tab) => (
          <TabLink key={tab.href} {...tab} active={pathname === tab.href} />
        ))}

        <Link
          href="/scan"
          aria-label="Scanner un document"
          className="flex h-14 w-14 -translate-y-4 items-center justify-center rounded-full bg-accent shadow-lg shadow-accent/30"
        >
          <Camera size={24} className="text-white" />
        </Link>

        {RIGHT_TABS.map((tab) => (
          <TabLink key={tab.href} {...tab} active={pathname === tab.href} />
        ))}
      </div>
    </nav>
  );
}
