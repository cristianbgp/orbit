import * as React from "react";

const COMPACT_FILTERS_BREAKPOINT = 1024;

export function useCompactFilters() {
  const [isCompact, setIsCompact] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const update = () => {
      setIsCompact(window.innerWidth < COMPACT_FILTERS_BREAKPOINT);
    };
    const media = window.matchMedia?.(
      `(max-width: ${COMPACT_FILTERS_BREAKPOINT - 1}px)`,
    );

    media?.addEventListener("change", update);
    window.addEventListener("resize", update);
    update();

    return () => {
      media?.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return !!isCompact;
}
