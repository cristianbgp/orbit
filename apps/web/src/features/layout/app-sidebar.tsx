import {
  Activity,
  Building2,
  BriefcaseBusiness,
  FolderKanban,
  ListTodo,
  LogOut,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { RefObject } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { OrbitMark } from "@/components/orbit-mark";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { AliasAvatar } from "@/features/identity/alias-avatar";
import { GlobalSearchTrigger } from "@/features/search/global-search-trigger";

type NavigationItem = {
  label: string;
  to: string;
  end: boolean;
  icon: LucideIcon;
};

const navigation: NavigationItem[] = [
  {
    label: "Proyectos",
    to: "/projects",
    end: false,
    icon: FolderKanban,
  },
  { label: "Casos", to: "/cases", end: false, icon: BriefcaseBusiness },
  { label: "Mi trabajo", to: "/my-work", end: true, icon: ListTodo },
  { label: "Actividad", to: "/activity", end: true, icon: Activity },
  { label: "Clientes", to: "/clients", end: false, icon: Building2 },
  { label: "Equipo", to: "/team", end: false, icon: Users },
];

function routeIsActive(pathname: string, item: NavigationItem) {
  return item.end
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function AppSidebar({
  fullName,
  email,
  alias,
  avatarColor,
  userId,
  searchTriggerRef,
  onOpenSearch,
  onSignOut,
}: {
  fullName: string;
  email: string;
  alias: string;
  avatarColor?: string;
  userId: string;
  searchTriggerRef: RefObject<HTMLButtonElement | null>;
  onOpenSearch(): void;
  onSignOut(): Promise<void> | void;
}) {
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

  function closeMobileNavigation() {
    if (isMobile) setOpenMobile(false);
  }

  function openSearch() {
    closeMobileNavigation();
    onOpenSearch();
  }

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-sidebar-border min-h-18 border-b p-3 group-data-[collapsible=icon]:min-h-24">
        <div className="flex min-w-0 items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col">
          <NavLink
            to="/projects"
            onClick={closeMobileNavigation}
            aria-label="Orbit, proyectos"
            className="focus-visible:ring-sidebar-ring rounded-control flex min-w-0 items-center gap-3 px-1 outline-none focus-visible:ring-2"
          >
            <OrbitMark className="size-8" />
            <span className="font-display text-xl font-semibold tracking-[-0.035em] group-data-[collapsible=icon]:hidden">
              Orbit
            </span>
          </NavLink>
          <SidebarTrigger
            aria-label="Contraer o expandir navegación"
            className="text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground group-data-[collapsible=icon]:mx-auto"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <div className="p-2 pb-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <GlobalSearchTrigger
                ref={searchTriggerRef}
                onClick={openSearch}
              />
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
        <nav aria-label="Principal" className="p-2">
          <SidebarMenu>
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = routeIsActive(location.pathname, item);
              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={item.label}
                    className="text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground h-11 group-data-[collapsible=icon]:h-11! group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
                  >
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={closeMobileNavigation}
                      aria-label={item.label}
                    >
                      <Icon aria-hidden="true" />
                      <span className="group-data-[collapsible=icon]:hidden">
                        {item.label}
                      </span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </nav>
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border border-t p-3 group-data-[collapsible=icon]:p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip="Ver perfil"
              className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground h-auto min-h-11 group-data-[collapsible=icon]:h-11! group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
            >
              <NavLink
                to="/profile"
                aria-label={`Ver perfil de ${fullName}`}
                onClick={closeMobileNavigation}
              >
                <AliasAvatar
                  userId={userId}
                  alias={alias}
                  avatarColor={avatarColor}
                  fullName={fullName}
                  size="sm"
                />
                <span className="min-w-0 group-data-[collapsible=icon]:hidden">
                  <span className="block truncate text-sm font-semibold">
                    {alias}
                  </span>
                  <span className="text-sidebar-muted block truncate text-xs">
                    {email}
                  </span>
                </span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground h-11 group-data-[collapsible=icon]:h-11! group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
              onClick={() => {
                closeMobileNavigation();
                void onSignOut();
              }}
            >
              <LogOut aria-hidden="true" />
              <span className="group-data-[collapsible=icon]:hidden">
                Cerrar sesión
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
