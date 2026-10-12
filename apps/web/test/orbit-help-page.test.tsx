import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { OrbitHelpRoute } from "@/features/help-assistant/orbit-help-route";
import { ApiClientError } from "@/lib/api/fetcher";

const mocks = vi.hoisted(() => ({
  flags: {
    data: undefined as
      undefined | { features: { orbitHelpAssistant: boolean } },
    isPending: true,
    isError: false,
  },
  mutateAsync: vi.fn(),
}));

vi.mock("@/lib/api/generated/feature-flags/feature-flags", () => ({
  useGetFeatureFlags: () => mocks.flags,
}));

vi.mock("@/lib/api/generated/orbit-help/orbit-help", () => ({
  useAskOrbitHelp: () => ({ mutateAsync: mocks.mutateAsync }),
}));

function renderRoute() {
  return render(
    <MemoryRouter>
      <OrbitHelpRoute userId="user-1" organizationId="org-1" />
    </MemoryRouter>,
  );
}

describe("Preguntar a Orbit", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("pointer: fine"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    mocks.flags.data = undefined;
    mocks.flags.isPending = true;
    mocks.flags.isError = false;
    mocks.mutateAsync.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("distinguishes flag loading, unavailable, and enabled states", () => {
    const rendered = renderRoute();
    expect(screen.getByText("Preparando Preguntar a Orbit")).toBeVisible();

    mocks.flags.isPending = false;
    mocks.flags.data = { features: { orbitHelpAssistant: false } };
    rendered.rerender(
      <MemoryRouter>
        <OrbitHelpRoute userId="user-1" organizationId="org-1" />
      </MemoryRouter>,
    );
    expect(
      screen.getByText("Esta función no está disponible para este estudio"),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Volver a proyectos" }),
    ).toHaveAttribute("href", "/projects");

    mocks.flags.data = { features: { orbitHelpAssistant: true } };
    rendered.rerender(
      <MemoryRouter>
        <OrbitHelpRoute userId="user-1" organizationId="org-1" />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: "Preguntar a Orbit" }),
    ).toBeVisible();
  });

  test("uses a suggestion and renders a documented answer with sources", async () => {
    mocks.flags.isPending = false;
    mocks.flags.data = { features: { orbitHelpAssistant: true } };
    mocks.mutateAsync.mockResolvedValue({
      answer: "La fecha final define el periodo planificado del proyecto.",
      sources: [{ document: "04-modelo-dominio.md", section: "Project" }],
    });
    renderRoute();

    fireEvent.click(
      screen.getByRole("button", {
        name: "¿Cómo funciona la fecha final de un proyecto?",
      }),
    );
    const question = screen.getByLabelText("Tu pregunta");
    expect(question).toHaveValue(
      "¿Cómo funciona la fecha final de un proyecto?",
    );
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        data: { question: "¿Cómo funciona la fecha final de un proyecto?" },
      }),
    );
    expect(await screen.findByText(/La fecha final define/)).toBeVisible();
    expect(screen.getByText("04-modelo-dominio.md")).toBeVisible();
    expect(screen.getByText("Project")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Hacer otra pregunta" }),
    );
    expect(screen.queryByText(/La fecha final define/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tu pregunta")).toHaveValue("");
  });

  test("renders a safe structured Markdown answer and keeps the original question visible", async () => {
    mocks.flags.isPending = false;
    mocks.flags.data = { features: { orbitHelpAssistant: true } };
    mocks.mutateAsync.mockResolvedValue({
      answer: [
        "## Fecha final",
        "",
        "La fecha final define el **cierre planificado**.",
        "",
        "- Ordena la cartera.",
        "- No reemplaza los eventos.",
        "",
        "| Estado | Significado |",
        "| --- | --- |",
        "| Activo | Trabajo vigente |",
        "",
        "- [x] Periodo definido",
        "- [ ] Equipo pendiente",
        "",
        "~~Texto reemplazado~~",
        "",
        '<img src="https://example.com/tracker.png" alt="tracker">',
        "",
        "[Sitio externo](https://example.com)",
      ].join("\n"),
      sources: [{ document: "04-modelo-dominio.md", section: "Project" }],
    });
    renderRoute();

    const question = screen.getByLabelText("Tu pregunta");
    fireEvent.change(question, {
      target: { value: "¿Cómo funciona la fecha final?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }));

    expect(
      await screen.findByRole("heading", { name: "Fecha final", level: 2 }),
    ).toBeVisible();
    expect(screen.getByText("cierre planificado").tagName).toBe("STRONG");
    expect(screen.getByText("Ordena la cartera.").closest("ul")).toBeVisible();
    const table = screen.getByRole("table");
    expect(table).toBeVisible();
    expect(table.parentElement).toHaveClass("overflow-x-auto");
    expect(screen.getByRole("columnheader", { name: "Estado" })).toBeVisible();
    const taskItems = screen.getAllByRole("checkbox");
    expect(taskItems).toHaveLength(2);
    expect(taskItems[0]).toBeChecked();
    expect(taskItems.every((item) => item.hasAttribute("disabled"))).toBe(true);
    expect(screen.getByText("Texto reemplazado").tagName).toBe("DEL");
    expect(screen.getByText("¿Cómo funciona la fecha final?")).toBeVisible();
    expect(
      screen.queryByRole("img", { name: "tracker" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Sitio externo" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Sitio externo")).toBeVisible();
  });

  test("focuses the question when the form appears and after choosing a suggestion", () => {
    mocks.flags.isPending = false;
    mocks.flags.data = { features: { orbitHelpAssistant: true } };
    renderRoute();

    const question = screen.getByLabelText("Tu pregunta");
    expect(question).toHaveFocus();

    const suggestion = screen.getByRole("button", {
      name: "¿Qué aparece en Mi trabajo?",
    });
    suggestion.focus();
    expect(suggestion).toHaveFocus();
    fireEvent.click(suggestion);

    expect(question).toHaveValue("¿Qué aparece en Mi trabajo?");
    expect(question).toHaveFocus();
  });

  test("does not open the keyboard when the help form appears on touch screens", () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: false,
      media: "(pointer: fine) and (min-width: 768px)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    mocks.flags.isPending = false;
    mocks.flags.data = { features: { orbitHelpAssistant: true } };

    renderRoute();

    expect(screen.getByLabelText("Tu pregunta")).not.toHaveFocus();
  });

  test("submits with Enter while preserving Shift+Enter and text composition", async () => {
    mocks.flags.isPending = false;
    mocks.flags.data = { features: { orbitHelpAssistant: true } };
    mocks.mutateAsync.mockResolvedValue({ answer: "Respuesta", sources: [] });
    renderRoute();

    const question = screen.getByLabelText("Tu pregunta");
    fireEvent.change(question, {
      target: { value: "¿Qué aparece en Mi trabajo?" },
    });
    expect(screen.getByText(/Enter para enviar/)).toBeVisible();

    expect(fireEvent.keyDown(question, { key: "Enter", shiftKey: true })).toBe(
      true,
    );
    expect(mocks.mutateAsync).not.toHaveBeenCalled();

    expect(
      fireEvent.keyDown(question, { key: "Enter", isComposing: true }),
    ).toBe(true);
    expect(mocks.mutateAsync).not.toHaveBeenCalled();

    expect(fireEvent.keyDown(question, { key: "Enter" })).toBe(false);
    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        data: { question: "¿Qué aparece en Mi trabajo?" },
      }),
    );
  });

  test("validates length and prevents duplicate submissions while pending", async () => {
    mocks.flags.isPending = false;
    mocks.flags.data = { features: { orbitHelpAssistant: true } };
    let resolveRequest!: (value: { answer: string; sources: [] }) => void;
    mocks.mutateAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    renderRoute();

    const question = screen.getByLabelText("Tu pregunta");
    fireEvent.change(question, { target: { value: "a" } });
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "al menos 2 caracteres",
    );
    expect(mocks.mutateAsync).not.toHaveBeenCalled();

    fireEvent.change(question, {
      target: { value: "¿Qué aparece en Mi trabajo?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }));
    expect(
      await screen.findByText("Consultando la documentación…"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Preguntar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Preguntar" }));
    expect(mocks.mutateAsync).toHaveBeenCalledOnce();
    resolveRequest({ answer: "Respuesta", sources: [] });
  });

  test.each([
    [429, "Alcanzaste el límite temporal de preguntas"],
    [503, "Preguntar a Orbit no está disponible temporalmente"],
  ])(
    "keeps the question and offers retry after HTTP %s",
    async (status, message) => {
      mocks.flags.isPending = false;
      mocks.flags.data = { features: { orbitHelpAssistant: true } };
      mocks.mutateAsync.mockRejectedValue(
        new ApiClientError("Request failed", {
          kind: "http",
          status,
          retryable: true,
        }),
      );
      renderRoute();
      const question = screen.getByLabelText("Tu pregunta");
      fireEvent.change(question, {
        target: { value: "¿Qué aparece en Mi trabajo?" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Preguntar" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(question).toHaveValue("¿Qué aparece en Mi trabajo?");
      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
      expect(mocks.mutateAsync).toHaveBeenCalledTimes(2);
    },
  );

  test("contains the page on narrow screens without horizontal overflow ownership", () => {
    mocks.flags.isPending = false;
    mocks.flags.data = { features: { orbitHelpAssistant: true } };
    renderRoute();
    const region = screen.getByRole("region", {
      name: "Asistente documental",
    });
    expect(region).toHaveClass("w-full", "min-w-0", "max-w-3xl");
    expect(region).not.toHaveClass("mt-7");
    expect(region).not.toHaveClass("mx-auto");
    expect(region.closest('[data-slot="app-page"]')).toHaveClass(
      "max-w-384",
      "py-6",
      "lg:py-8",
    );
    const heading = screen.getByRole("heading", { name: "Preguntar a Orbit" });
    const pageHeader = heading.closest('[data-slot="app-page-header"]');
    expect(pageHeader?.parentElement).toBe(
      heading.closest('[data-slot="app-page"]'),
    );
    expect(pageHeader?.nextElementSibling).toHaveAttribute(
      "data-slot",
      "app-page-content",
    );
    expect(heading).toHaveClass("font-display", "text-3xl", "sm:text-4xl");
    expect(
      pageHeader?.querySelector("svg.lucide-message-circle-question-mark"),
    ).toHaveAttribute("aria-hidden", "true");
    expect(region.className).not.toContain("min-w-max");
  });
});
