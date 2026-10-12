import { useEffect, useRef, type RefObject } from "react";
import { useNavigate } from "react-router-dom";

import { GlobalSearchDialog } from "./global-search-dialog";
import { useGlobalSearch } from "./use-global-search";

export function GlobalSearch({
  userId,
  organizationId,
  open,
  onOpenChange,
  restoreFocusRef,
  helpAssistantEnabled,
}: {
  userId: string;
  organizationId: string;
  open: boolean;
  onOpenChange(open: boolean): void;
  restoreFocusRef: RefObject<HTMLElement | null>;
  helpAssistantEnabled: boolean;
}) {
  const navigate = useNavigate();
  const search = useGlobalSearch({ userId, organizationId });
  const wasOpenRef = useRef(open);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (wasOpen && !open) {
      requestAnimationFrame(() => {
        const opener = restoreFocusRef.current;
        if (opener?.isConnected) opener.focus();
      });
    }
  }, [open, restoreFocusRef]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key.toLowerCase() === "k" &&
        event.metaKey !== event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.preventDefault();
        if (open) {
          onOpenChange(false);
          search.setQuery("");
        } else {
          onOpenChange(true);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open, restoreFocusRef, search.setQuery]);

  function changeOpen(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) search.setQuery("");
  }

  function select(destination: string) {
    changeOpen(false);
    navigate(destination);
  }

  return (
    <GlobalSearchDialog
      open={open}
      onOpenChange={changeOpen}
      query={search.query}
      onQueryChange={search.setQuery}
      normalizedQuery={search.normalizedQuery}
      debouncedQuery={search.debouncedQuery}
      enabled={search.enabled}
      isCurrentQuery={search.isCurrentQuery}
      data={search.searchQuery.data}
      isPending={search.searchQuery.isPending}
      isFetching={search.searchQuery.isFetching}
      isError={search.searchQuery.isError}
      onRetry={() => void search.searchQuery.refetch()}
      onSelect={select}
      helpAssistantEnabled={helpAssistantEnabled}
    />
  );
}
