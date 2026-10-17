import { forwardRef } from "react";
import { Search } from "lucide-react";

import { SidebarMenuButton } from "@/components/ui/sidebar";

function platformShortcut() {
  return typeof navigator !== "undefined" && /Mac/i.test(navigator.platform)
    ? "⌘ K"
    : "Ctrl K";
}

export const GlobalSearchTrigger = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof SidebarMenuButton>
>(function GlobalSearchTrigger(props, ref) {
  return (
    <SidebarMenuButton
      ref={ref}
      type="button"
      tooltip="Buscar"
      aria-label="Buscar"
      className="text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground h-11 group-data-[collapsible=icon]:h-11! group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
      {...props}
    >
      <Search aria-hidden="true" />
      <span className="group-data-[collapsible=icon]:hidden">Buscar</span>
      <kbd className="border-sidebar-border bg-sidebar-accent/60 ml-auto rounded border px-1.5 py-0.5 font-mono text-[0.625rem] group-data-[collapsible=icon]:hidden">
        {platformShortcut()}
      </kbd>
    </SidebarMenuButton>
  );
});
