export type SidebarPreference = "expanded" | "collapsed";

export const SIDEBAR_PREFERENCE_KEY = "orbit.sidebar.state.v1";

type SidebarStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(browser: Window & typeof globalThis) {
  return browser.localStorage;
}

export function readSidebarPreference(
  storage?: SidebarStorage,
  browser: Window & typeof globalThis = window,
): SidebarPreference {
  try {
    const value = (storage ?? browserStorage(browser)).getItem(
      SIDEBAR_PREFERENCE_KEY,
    );
    return value === "collapsed" || value === "expanded" ? value : "expanded";
  } catch {
    return "expanded";
  }
}

export function writeSidebarPreference(
  state: SidebarPreference,
  storage?: SidebarStorage,
  browser: Window & typeof globalThis = window,
) {
  try {
    (storage ?? browserStorage(browser)).setItem(SIDEBAR_PREFERENCE_KEY, state);
  } catch {
    // The current in-memory state remains usable when persistence is denied.
  }
}
