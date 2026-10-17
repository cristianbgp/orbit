import { useEffect, type RefObject } from "react";

const DESKTOP_AUTOFOCUS_QUERY = "(pointer: fine) and (min-width: 768px)";

export function useDesktopAutofocus<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: { select?: boolean } = {},
) {
  useEffect(() => {
    if (!window.matchMedia(DESKTOP_AUTOFOCUS_QUERY).matches) return;

    ref.current?.focus();
    if (options.select && ref.current instanceof HTMLInputElement) {
      ref.current.select();
    }
  }, [options.select, ref]);
}
