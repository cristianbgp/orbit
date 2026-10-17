import { useEffect, useState } from "react";

export const PROJECT_TIMELINE_STAGE_WIDTH_KEY =
  "orbit:project-timeline-stage-width";
export const DEFAULT_STAGE_WIDTH_PX = 224;
export const MIN_STAGE_WIDTH_PX = 180;
export const MAX_STAGE_WIDTH_PX = 360;

const desktopTimelineQuery = "(min-width: 768px)";

export function isTimelineStageWidth(width: number) {
  return (
    Number.isFinite(width) &&
    width >= MIN_STAGE_WIDTH_PX &&
    width <= MAX_STAGE_WIDTH_PX
  );
}

export function readTimelineStageWidth(storage?: Pick<Storage, "getItem">) {
  try {
    const availableStorage =
      storage ??
      (typeof window === "undefined" ? undefined : window.localStorage);
    const width = Number(
      availableStorage?.getItem(PROJECT_TIMELINE_STAGE_WIDTH_KEY) ?? Number.NaN,
    );
    return isTimelineStageWidth(width) ? width : DEFAULT_STAGE_WIDTH_PX;
  } catch {
    return DEFAULT_STAGE_WIDTH_PX;
  }
}

export function writeTimelineStageWidth(
  width: number,
  storage?: Pick<Storage, "setItem">,
) {
  if (!isTimelineStageWidth(width)) return;
  try {
    const availableStorage =
      storage ??
      (typeof window === "undefined" ? undefined : window.localStorage);
    availableStorage?.setItem(
      PROJECT_TIMELINE_STAGE_WIDTH_KEY,
      String(Math.round(width)),
    );
  } catch {
    // Storage preferences must never block project work.
  }
}

function desktopTimelineMatches() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(desktopTimelineQuery).matches
  );
}

export function useDesktopTimelineLayout() {
  const [desktop, setDesktop] = useState(desktopTimelineMatches);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(desktopTimelineQuery);
    const update = (event: MediaQueryListEvent) => setDesktop(event.matches);
    setDesktop(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return desktop;
}
