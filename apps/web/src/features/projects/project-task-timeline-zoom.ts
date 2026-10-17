import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

export const TIMELINE_ZOOM_KEY = "orbit:project-timeline-zoom:v1";
export const MIN_TIMELINE_DAY_WIDTH = 40;
export const TIMELINE_MANUAL_DAY_WIDTHS = [56, 80, 112] as const;

export type TimelineZoomPreference =
  "fit" | (typeof TIMELINE_MANUAL_DAY_WIDTHS)[number];

type TimelineZoomStorage = Pick<Storage, "getItem" | "setItem">;

function isTimelineZoomPreference(
  value: string | number,
): value is TimelineZoomPreference {
  return (
    value === "fit" ||
    TIMELINE_MANUAL_DAY_WIDTHS.includes(
      Number(value) as (typeof TIMELINE_MANUAL_DAY_WIDTHS)[number],
    )
  );
}

function browserStorage(browser?: Window & typeof globalThis) {
  if (browser) return browser.localStorage;
  return typeof window === "undefined" ? undefined : window.localStorage;
}

export function readTimelineZoomPreference(
  storage?: TimelineZoomStorage,
  browser?: Window & typeof globalThis,
): TimelineZoomPreference {
  try {
    const value = (storage ?? browserStorage(browser))?.getItem(
      TIMELINE_ZOOM_KEY,
    );
    if (value === "fit") return value;
    const numericValue = Number(value);
    return isTimelineZoomPreference(numericValue) ? numericValue : "fit";
  } catch {
    return "fit";
  }
}

export function writeTimelineZoomPreference(
  preference: TimelineZoomPreference,
  storage?: TimelineZoomStorage,
  browser?: Window & typeof globalThis,
) {
  try {
    (storage ?? browserStorage(browser))?.setItem(
      TIMELINE_ZOOM_KEY,
      String(preference),
    );
  } catch {
    // Browser preference storage must never block project work.
  }
}

export function timelineFitDayWidth(viewportWidth: number, dayCount: number) {
  if (viewportWidth <= 0 || dayCount <= 0) return MIN_TIMELINE_DAY_WIDTH;
  return Math.max(MIN_TIMELINE_DAY_WIDTH, viewportWidth / dayCount);
}

export function timelineEffectiveDayWidth(
  preference: TimelineZoomPreference,
  viewportWidth: number,
  dayCount: number,
) {
  const fitWidth = timelineFitDayWidth(viewportWidth, dayCount);
  return preference === "fit" ? fitWidth : Math.max(preference, fitWidth);
}

export function nextTimelineZoom(
  preference: TimelineZoomPreference,
  fitWidth: number,
): TimelineZoomPreference {
  const effectiveWidth =
    preference === "fit" ? fitWidth : Math.max(preference, fitWidth);
  return (
    TIMELINE_MANUAL_DAY_WIDTHS.find((width) => width > effectiveWidth) ??
    preference
  );
}

export function previousTimelineZoom(
  preference: TimelineZoomPreference,
  fitWidth: number,
): TimelineZoomPreference {
  if (preference === "fit") return preference;
  const previous = [...TIMELINE_MANUAL_DAY_WIDTHS]
    .reverse()
    .find((width) => width < preference && width > fitWidth);
  return previous ?? "fit";
}

export function anchoredTimelineScrollLeft({
  oldScrollLeft,
  viewportWidth,
  newViewportWidth = viewportWidth,
  oldDayWidth,
  newDayWidth,
  dayCount,
}: {
  oldScrollLeft: number;
  viewportWidth: number;
  newViewportWidth?: number;
  oldDayWidth: number;
  newDayWidth: number;
  dayCount: number;
}) {
  const maximum = Math.max(0, newDayWidth * dayCount - newViewportWidth);
  if (oldDayWidth <= 0 || viewportWidth <= 0 || dayCount <= 0) return 0;
  const centerDay = (oldScrollLeft + viewportWidth / 2) / oldDayWidth;
  const target = centerDay * newDayWidth - newViewportWidth / 2;
  return Math.min(maximum, Math.max(0, target));
}

type PendingTimelineAnchor = {
  oldScrollLeft: number;
  viewportWidth: number;
  oldDayWidth: number;
};

export function useTimelineZoom({
  dayCount,
  scrollRegionRef,
  viewportInset = 0,
  layoutKey,
}: {
  dayCount: number;
  scrollRegionRef: RefObject<HTMLDivElement | null>;
  viewportInset?: number;
  layoutKey?: unknown;
}) {
  const [preference, setPreference] = useState<TimelineZoomPreference>(
    readTimelineZoomPreference,
  );
  const [measuredViewportWidth, setMeasuredViewportWidth] = useState(0);
  const fallbackViewportWidth = Math.max(0, dayCount * 80);
  const viewportWidth =
    measuredViewportWidth > 0 ? measuredViewportWidth : fallbackViewportWidth;
  const fitWidth = timelineFitDayWidth(viewportWidth, dayCount);
  const dayWidth = timelineEffectiveDayWidth(
    preference,
    viewportWidth,
    dayCount,
  );
  const dayWidthRef = useRef(dayWidth);
  const viewportWidthRef = useRef(viewportWidth);
  const measuredViewportWidthRef = useRef(measuredViewportWidth);
  const pendingAnchorRef = useRef<PendingTimelineAnchor | null>(null);
  dayWidthRef.current = dayWidth;
  viewportWidthRef.current = viewportWidth;
  measuredViewportWidthRef.current = measuredViewportWidth;

  const prepareAnchor = useCallback(() => {
    const scrollRegion = scrollRegionRef.current;
    if (!scrollRegion) return;
    pendingAnchorRef.current = {
      oldScrollLeft: scrollRegion.scrollLeft,
      viewportWidth: viewportWidthRef.current,
      oldDayWidth: dayWidthRef.current,
    };
  }, [scrollRegionRef]);

  useLayoutEffect(() => {
    const scrollRegion = scrollRegionRef.current;
    if (!scrollRegion) return;

    function measure(width: number) {
      const availableWidth = Math.max(0, width - viewportInset);
      if (
        availableWidth <= 0 ||
        Math.abs(availableWidth - measuredViewportWidthRef.current) < 0.5
      ) {
        return;
      }
      prepareAnchor();
      measuredViewportWidthRef.current = availableWidth;
      setMeasuredViewportWidth(availableWidth);
    }

    measure(scrollRegion.clientWidth);

    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver((entries) => {
        const entry = entries.find(({ target }) => target === scrollRegion);
        if (entry) measure(entry.contentRect.width);
      });
      observer.observe(scrollRegion);
      return () => observer.disconnect();
    }

    const measureWindow = () => measure(scrollRegion.clientWidth);
    window.addEventListener("resize", measureWindow);
    return () => window.removeEventListener("resize", measureWindow);
  }, [dayCount, layoutKey, prepareAnchor, scrollRegionRef, viewportInset]);

  useLayoutEffect(() => {
    const pendingAnchor = pendingAnchorRef.current;
    const scrollRegion = scrollRegionRef.current;
    if (!pendingAnchor || !scrollRegion) return;
    pendingAnchorRef.current = null;
    scrollRegion.scrollLeft = anchoredTimelineScrollLeft({
      ...pendingAnchor,
      newViewportWidth: viewportWidth,
      newDayWidth: dayWidth,
      dayCount,
    });
  }, [dayCount, dayWidth, scrollRegionRef, viewportWidth]);

  const changePreference = useCallback(
    (nextPreference: TimelineZoomPreference) => {
      if (nextPreference === preference) return;
      prepareAnchor();
      setPreference(nextPreference);
      writeTimelineZoomPreference(nextPreference);
    },
    [preference, prepareAnchor],
  );

  const nextPreference = nextTimelineZoom(preference, fitWidth);
  const previousPreference = previousTimelineZoom(preference, fitWidth);

  return {
    preference,
    dayWidth,
    canZoomIn: nextPreference !== preference,
    canZoomOut: previousPreference !== preference,
    zoomIn: () => changePreference(nextPreference),
    zoomOut: () => changePreference(previousPreference),
    fit: () => changePreference("fit"),
  };
}
