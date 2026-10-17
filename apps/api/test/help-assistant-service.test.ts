import { describe, expect, test, vi } from "vitest";

import {
  createHelpAssistantService,
  HelpAssistantServiceError,
} from "../src/help-assistant/help-assistant-service";

const actor = { userId: "user-1", organizationId: "org-1" };
const section = {
  document: "04-modelo-dominio.md",
  heading: "Project",
  content: "El proyecto usa fecha de inicio y fecha final.",
  normalizedTerms: ["proyecto", "fecha", "inicio", "final"],
};

describe("Orbit help assistant service", () => {
  test("returns deterministic insufficiency without consuming quota or calling Groq", async () => {
    const provider = { answer: vi.fn() };
    const limiter = { consume: vi.fn() };
    const service = createHelpAssistantService({
      retrieve: () => [],
      provider,
      limiter,
    });

    await expect(
      service.ask(actor, "¿Cómo preparo tiramisú?"),
    ).resolves.toEqual({
      answer:
        "La documentación actual de Orbit no contiene suficiente información para responder esa pregunta.",
      sources: [],
    });
    expect(provider.answer).not.toHaveBeenCalled();
    expect(limiter.consume).not.toHaveBeenCalled();
  });

  test("returns the provider answer with Orbit-derived sources", async () => {
    const provider = {
      answer: vi.fn().mockResolvedValue("Respuesta documentada"),
    };
    const service = createHelpAssistantService({
      retrieve: () => [section, section],
      provider,
      limiter: { consume: () => true },
    });

    await expect(service.ask(actor, "¿Qué es un proyecto?")).resolves.toEqual({
      answer: "Respuesta documentada",
      sources: [{ document: "04-modelo-dominio.md", section: "Project" }],
    });
    expect(provider.answer).toHaveBeenCalledWith({
      question: "¿Qué es un proyecto?",
      sections: [section, section],
    });
  });

  test("rejects before the provider when the user reaches the Orbit limit", async () => {
    const provider = { answer: vi.fn() };
    const service = createHelpAssistantService({
      retrieve: () => [section],
      provider,
      limiter: { consume: () => false },
    });

    await expect(service.ask(actor, "¿Qué es un proyecto?")).rejects.toEqual(
      new HelpAssistantServiceError(
        "HELP_RATE_LIMITED",
        "Alcanzaste el límite temporal de preguntas. Inténtalo más tarde.",
      ),
    );
    expect(provider.answer).not.toHaveBeenCalled();
  });
});
