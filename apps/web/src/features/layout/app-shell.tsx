import { useRef, useState } from "react";
import { Outlet } from "react-router-dom";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useGetCurrentUser } from "@/lib/api/generated/identity/identity";
import { GlobalSearch } from "@/features/search/global-search";
import { useFeatureFlag } from "@/features/feature-flags/use-feature-flag";
import { AppSidebar } from "./app-sidebar";
import { MobileAppHeader } from "./mobile-app-header";
import {
  readSidebarPreference,
  writeSidebarPreference,
} from "./sidebar-preference";

type AppShellProps = {
  user: { id?: string; name: string; email: string };
  organizationId?: string;
  onSignOut(): Promise<void> | void;
};

export function AppShell({
  user,
  organizationId = "no-active-organization",
  onSignOut,
}: AppShellProps) {
  const currentUserQuery = useGetCurrentUser();
  const currentUser = currentUserQuery.data?.user;
  const fullName = currentUser?.name ?? user.name;
  const email = currentUser?.email ?? user.email;
  const alias = currentUser?.alias ?? user.name;
  const avatarColor = currentUser?.avatarColor;
  const userId = currentUser?.id ?? user.id ?? user.email;
  const helpAssistantEnabled = useFeatureFlag("orbitHelpAssistant", {
    userId,
    organizationId,
  });
  const [sidebarOpen, setSidebarOpen] = useState(
    () => readSidebarPreference() === "expanded",
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const searchOpenerRef = useRef<HTMLButtonElement | null>(null);

  function changeSidebarOpen(open: boolean) {
    setSidebarOpen(open);
    writeSidebarPreference(open ? "expanded" : "collapsed");
  }

  function openSearch() {
    setSearchOpen(true);
  }

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={changeSidebarOpen}
      className="bg-background text-foreground min-w-0"
    >
      <AppSidebar
        fullName={fullName}
        email={email}
        alias={alias}
        avatarColor={avatarColor}
        userId={userId}
        searchTriggerRef={searchOpenerRef}
        onOpenSearch={openSearch}
        onSignOut={onSignOut}
      />
      <GlobalSearch
        userId={userId}
        organizationId={organizationId}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        restoreFocusRef={searchOpenerRef}
        helpAssistantEnabled={helpAssistantEnabled}
      />
      <SidebarInset className="min-w-0">
        <MobileAppHeader
          fullName={fullName}
          alias={alias}
          avatarColor={avatarColor}
          userId={userId}
        />
        <div data-slot="app-content" className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
