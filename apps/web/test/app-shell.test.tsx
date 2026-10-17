import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AppShell } from "@/features/layout/app-shell";

const mocks = vi.hoisted(() => ({
  currentUser: {
    data: {
      user: {
        id: "user-1",
        alias: "CGP",
        name: "Cristian Granda",
        email: "cristian@orbit.pe",
        image: null,
        createdAt: "2026-08-01T10:00:00.000Z",
      },
    } as
      | {
          user: {
            id: string;
            alias: string;
            name: string;
            email: string;
            image: null;
            createdAt: string;
          };
        }
      | undefined,
    isPending: false,
  },
}));

vi.mock("@/lib/api/generated/identity/identity", () => ({
  useGetCurrentUser: () => mocks.currentUser,
}));

vi.mock("@/lib/api/generated/search/search", () => ({
  useSearchGlobally: () => ({
    data: undefined,
    isPending: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/features/feature-flags/use-feature-flag", () => ({
  useFeatureFlag: () => false,
}));

describe("AppShell", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    window.localStorage.clear();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    mocks.currentUser.data = {
      user: {
        id: "user-1",
        alias: "CGP",
        name: "Cristian Granda",
        email: "cristian@orbit.pe",
        image: null,
        createdAt: "2026-08-01T10:00:00.000Z",
      },
    };
    mocks.currentUser.isPending = false;
  });

  test("starts expanded, persists collapse, and supports the keyboard shortcut", async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route
            element={
              <AppShell
                user={{
                  name: "Cristian Granda",
                  email: "cristian@orbit.pe",
                }}
                onSignOut={vi.fn()}
              />
            }
          >
            <Route index element={<p>Inicio</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const sidebar = document.querySelector('[data-slot="sidebar"]');
    expect(sidebar).toHaveAttribute("data-state", "expanded");
    expect(document.querySelector('[data-slot="sidebar-wrapper"]')).toHaveClass(
      "min-h-dvh",
    );
    expect(
      document.querySelector('[data-slot="sidebar-wrapper"]'),
    ).not.toHaveClass("min-h-svh");
    expect(
      document.querySelector('[data-slot="sidebar-container"]'),
    ).toHaveClass("h-dvh");
    expect(
      document.querySelector('[data-slot="sidebar-container"]'),
    ).not.toHaveClass("h-svh");
    expect(document.querySelector('[data-slot="sidebar-content"]')).toHaveClass(
      "overscroll-contain",
    );
    expect(document.querySelector('[data-slot="app-content"]')).toHaveClass(
      "flex",
      "min-h-0",
      "flex-1",
      "flex-col",
    );
    const searchButton = screen.getByRole("button", { name: "Buscar" });
    const primaryNavigation = screen.getByRole("navigation", {
      name: "Principal",
    });
    expect(
      searchButton.compareDocumentPosition(primaryNavigation) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Contraer o expandir navegación",
      }),
    );
    expect(sidebar).toHaveAttribute("data-state", "collapsed");
    expect(window.localStorage.getItem("orbit.sidebar.state.v1")).toBe(
      "collapsed",
    );
    const projectsLink = screen.getByRole("link", { name: "Proyectos" });
    expect(projectsLink).toHaveClass(
      "group-data-[collapsible=icon]:h-11!",
      "group-data-[collapsible=icon]:w-full!",
      "group-data-[collapsible=icon]:justify-center",
      "group-data-[collapsible=icon]:p-0!",
    );
    expect(screen.getByText("Proyectos")).toHaveClass(
      "group-data-[collapsible=icon]:hidden",
    );
    const sidebarFooter = document.querySelector(
      '[data-slot="sidebar-footer"]',
    ) as HTMLElement;
    expect(sidebarFooter).toHaveClass("group-data-[collapsible=icon]:p-2");
    const profileLink = within(sidebarFooter).getByRole("link", {
      name: "Ver perfil de Cristian Granda",
    });
    expect(profileLink).toHaveClass(
      "group-data-[collapsible=icon]:h-11!",
      "group-data-[collapsible=icon]:w-full!",
      "group-data-[collapsible=icon]:justify-center",
      "group-data-[collapsible=icon]:p-0!",
    );
    expect(
      within(sidebarFooter).getByText("cristian@orbit.pe").parentElement,
    ).toHaveClass("group-data-[collapsible=icon]:hidden");
    const signOutButton = within(sidebarFooter).getByRole("button", {
      name: "Cerrar sesión",
    });
    expect(signOutButton).toHaveClass(
      "group-data-[collapsible=icon]:h-11!",
      "group-data-[collapsible=icon]:w-full!",
      "group-data-[collapsible=icon]:justify-center",
      "group-data-[collapsible=icon]:p-0!",
    );
    expect(within(sidebarFooter).getByText("Cerrar sesión")).toHaveClass(
      "group-data-[collapsible=icon]:hidden",
    );
    fireEvent.focus(screen.getByRole("link", { name: "Proyectos" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Proyectos");

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    await waitFor(() =>
      expect(sidebar).toHaveAttribute("data-state", "expanded"),
    );
    expect(window.localStorage.getItem("orbit.sidebar.state.v1")).toBe(
      "expanded",
    );

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(
      await screen.findByRole("dialog", { name: "Buscar en Orbit" }),
    ).toBeVisible();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Buscar en Orbit" }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(searchButton).toHaveFocus());

    fireEvent.click(document.querySelector('[data-slot="sidebar-rail"]')!);
    expect(sidebar).toHaveAttribute("data-state", "collapsed");
  });

  test("restores a collapsed desktop preference", () => {
    window.localStorage.setItem("orbit.sidebar.state.v1", "collapsed");

    render(
      <MemoryRouter>
        <Routes>
          <Route
            element={
              <AppShell
                user={{ name: "Ana Torres", email: "ana@orbit.pe" }}
                onSignOut={vi.fn()}
              />
            }
          >
            <Route index element={<p>Inicio</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(document.querySelector('[data-slot="sidebar"]')).toHaveAttribute(
      "data-state",
      "collapsed",
    );
  });

  test("opens mobile navigation and closes it after selecting a route", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 375,
    });

    render(
      <MemoryRouter>
        <Routes>
          <Route
            element={
              <AppShell
                user={{ name: "Ana Torres", email: "ana@orbit.pe" }}
                onSignOut={vi.fn()}
              />
            }
          >
            <Route index element={<p>Inicio móvil</p>} />
            <Route path="projects" element={<p>Proyectos móviles</p>} />
            <Route path="projects/new" element={<p>Nuevo proyecto móvil</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const trigger = await screen.findByRole("button", {
      name: "Abrir navegación",
    });
    expect(trigger).toHaveClass("size-11");
    expect(trigger.closest("header")).toHaveClass("z-50");
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", {
      name: "Navegación principal",
    });
    expect(dialog).toBeVisible();
    expect(dialog).toHaveClass("z-[70]");
    expect(
      dialog.querySelector('[data-slot="sidebar-mobile-content"]'),
    ).toHaveClass("pb-[env(safe-area-inset-bottom)]");
    fireEvent.click(
      screen.getByRole("link", { name: "Proyectos", hidden: false }),
    );

    expect(await screen.findByText("Proyectos móviles")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Navegación principal" }),
      ).not.toBeInTheDocument(),
    );

    fireEvent.click(trigger);
    expect(
      await screen.findByRole("dialog", { name: "Navegación principal" }),
    ).toBeVisible();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Navegación principal" }),
      ).not.toBeInTheDocument(),
    );

    fireEvent.click(trigger);
    const reopenedNavigation = await screen.findByRole("dialog", {
      name: "Navegación principal",
    });
    fireEvent.click(
      within(reopenedNavigation).getByRole("button", { name: "Buscar" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Buscar en Orbit" }),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Navegación principal" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(
      document.querySelector('[data-mobile="true"]'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Buscar en Orbit" }),
    ).toHaveFocus();
    fireEvent.click(screen.getByRole("option", { name: "Nuevo proyecto" }));
    expect(await screen.findByText("Nuevo proyecto móvil")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Navegación principal" }),
      ).not.toBeInTheDocument(),
    );
  });

  test("shows Orbit navigation, active route, identity, and sign out", () => {
    const onSignOut = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={["/projects"]}>
        <Routes>
          <Route
            element={
              <AppShell
                user={{
                  name: "Cristian Granda",
                  email: "cristian@orbit.pe",
                }}
                onSignOut={onSignOut}
              />
            }
          >
            <Route path="projects" element={<p>Cartera de proyectos</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("navigation", { name: "Principal" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Inicio" })).toBeNull();
    for (const orbitLink of screen.getAllByRole("link", {
      name: "Orbit, proyectos",
    })) {
      expect(orbitLink).toHaveAttribute("href", "/projects");
    }
    expect(screen.getByRole("link", { name: "Actividad" })).toHaveAttribute(
      "href",
      "/activity",
    );
    expect(screen.getByRole("link", { name: "Proyectos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Clientes" })).toHaveAttribute(
      "href",
      "/clients",
    );
    expect(screen.getByRole("link", { name: "Equipo" })).toHaveAttribute(
      "href",
      "/team",
    );
    const links = screen.getAllByRole("link").map((link) => link.textContent);
    expect(links.indexOf("Proyectos")).toBeLessThan(links.indexOf("Clientes"));
    for (const profileLink of screen.getAllByRole("link", {
      name: /Ver perfil de Cristian Granda/,
    })) {
      expect(profileLink).toHaveAttribute("href", "/profile");
    }
    expect(screen.getAllByText("CGP")).not.toHaveLength(0);
    expect(screen.getByText("cristian@orbit.pe")).toBeInTheDocument();
    expect(screen.getByText("Cartera de proyectos")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  test("uses session identity while the current profile is loading", () => {
    mocks.currentUser.data = undefined;
    mocks.currentUser.isPending = true;

    render(
      <MemoryRouter>
        <Routes>
          <Route
            element={
              <AppShell
                user={{ name: "Ana Torres", email: "ana@orbit.pe" }}
                onSignOut={vi.fn()}
              />
            }
          >
            <Route index element={<p>Inicio</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    for (const profileLink of screen.getAllByRole("link", {
      name: "Ver perfil de Ana Torres",
    })) {
      expect(profileLink).toHaveAttribute("href", "/profile");
    }
    expect(screen.getByText("ana@orbit.pe")).toBeInTheDocument();
  });
});
