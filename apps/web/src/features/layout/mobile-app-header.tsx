import { NavLink } from "react-router-dom";

import { OrbitMark } from "@/components/orbit-mark";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AliasAvatar } from "@/features/identity/alias-avatar";

export function MobileAppHeader({
  fullName,
  alias,
  avatarColor,
  userId,
}: {
  fullName: string;
  alias: string;
  avatarColor?: string;
  userId: string;
}) {
  return (
    <header className="border-sidebar-border bg-sidebar text-sidebar-foreground sticky top-0 z-50 flex min-h-16 items-center justify-between gap-3 border-b px-3 md:hidden">
      <SidebarTrigger
        aria-label="Abrir navegación"
        className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground size-11"
      />
      <NavLink
        to="/projects"
        aria-label="Orbit, proyectos"
        className="focus-visible:ring-sidebar-ring rounded-control flex items-center gap-2 outline-none focus-visible:ring-2"
      >
        <OrbitMark className="size-7" />
        <span className="font-display text-lg font-semibold">Orbit</span>
      </NavLink>
      <NavLink
        to="/profile"
        aria-label={`Ver perfil de ${fullName}`}
        className="focus-visible:ring-sidebar-ring rounded-control outline-none focus-visible:ring-2"
      >
        <AliasAvatar
          userId={userId}
          alias={alias}
          avatarColor={avatarColor}
          fullName={fullName}
          size="sm"
        />
      </NavLink>
    </header>
  );
}
