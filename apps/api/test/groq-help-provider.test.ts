import { describe, expect, test, vi } from "vitest";

import {
  createGroqHelpProvider,
  HelpProviderUnavailableError,
} from "../src/help-assistant/groq-help-provider";

const sections = [
  {
    document: "04-modelo-dominio.md",
    heading: "Project",
    content: "El proyecto usa fecha de inicio y fecha final.",
    normalizedTerms: ["proyecto", "fecha", "inicio", "final"],
  },
];

describe("Groq Orbit help provider", () => {
  test("sends only the question and selected documentation with bounded generation", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "La fecha final cierra el periodo planificado.",
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const provider = createGroqHelpProvider({
      apiKey: "secret-token",
      model: "llama-test",
      fetcher,
    });

    await expect(
      provider.answer({
        question: "¿Qué es la fecha final?",
        sections,
      }),
    ).resolves.toBe("La fecha final cierra el periodo planificado.");

    const [url, request] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(new Headers(request?.headers).get("Authorization")).toBe(
      "Bearer secret-token",
    );
    const body = JSON.parse(String(request?.body));
    expect(body).toMatchObject({
      model: "llama-test",
      stream: false,
      temperature: 0.2,
      max_completion_tokens: 1200,
    });
    expect(body).not.toHaveProperty("reasoning_effort");
    expect(body).not.toHaveProperty("reasoning_format");
    expect(body).not.toHaveProperty("include_reasoning");
    expect(JSON.stringify(body.messages)).toContain("¿Qué es la fecha final?");
    expect(JSON.stringify(body.messages)).toContain("04-modelo-dominio.md");
    expect(JSON.stringify(body.messages)).not.toContain("secret-token");
    expect(JSON.stringify(body.messages)).not.toContain("organizationId");
    expect(JSON.stringify(body.messages)).toContain("Markdown sencillo");
    expect(JSON.stringify(body.messages)).toContain("No uses HTML");
    expect(JSON.stringify(body.messages)).toContain("tablas");
    expect(JSON.stringify(body.messages)).toContain("No incluyas enlaces");
  });

  test("uses the GPT OSS default with bounded hidden reasoning", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Respuesta breve." } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const provider = createGroqHelpProvider({
      apiKey: "secret-token",
      fetcher,
    });

    await provider.answer({ question: "Pregunta", sections });

    const [, request] = fetcher.mock.calls[0]!;
    const body = JSON.parse(String(request?.body));
    expect(body).toMatchObject({
      model: "openai/gpt-oss-20b",
      reasoning_effort: "low",
      include_reasoning: false,
      max_completion_tokens: 1200,
    });
    expect(body).not.toHaveProperty("reasoning_format");
  });

  test("retries a length-limited completion once with a concise rewrite", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "length",
                message: { content: "Respuesta cortada a la mitad" },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: { content: "Respuesta completa y concisa." },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    const provider = createGroqHelpProvider({ apiKey: "secret", fetcher });

    await expect(
      provider.answer({ question: "Explica Mi trabajo", sections }),
    ).resolves.toBe("Respuesta completa y concisa.");

    expect(fetcher).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body));
    expect(retryBody.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: "Respuesta cortada a la mitad",
        }),
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("respuesta completa"),
        }),
      ]),
    );
  });

  test("marks the answer when the concise retry also reaches the limit", async () => {
    const limitedResponse = (content: string) =>
      new Response(
        JSON.stringify({
          choices: [{ finish_reason: "length", message: { content } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(limitedResponse("Primer intento incompleto"))
      .mockResolvedValueOnce(limitedResponse("Segundo intento incompleto"));
    const provider = createGroqHelpProvider({ apiKey: "secret", fetcher });

    const answer = await provider.answer({ question: "Pregunta", sections });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(answer).toContain("**Respuesta incompleta:**");
    expect(answer).toContain("Segundo intento incompleto");
  });

  test("preserves the first partial answer when its retry is unavailable", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "length",
                message: { content: "Contenido parcial recuperable" },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response("failure", { status: 503 }));
    const provider = createGroqHelpProvider({ apiKey: "secret", fetcher });

    const answer = await provider.answer({ question: "Pregunta", sections });

    expect(answer).toContain("**Respuesta incompleta:**");
    expect(answer).toContain("Contenido parcial recuperable");
  });

  test.each([429, 500])(
    "maps Groq HTTP %s to provider unavailable",
    async (status) => {
      const provider = createGroqHelpProvider({
        apiKey: "secret",
        fetcher: vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response("failure", { status })),
      });

      await expect(
        provider.answer({ question: "Pregunta", sections }),
      ).rejects.toBeInstanceOf(HelpProviderUnavailableError);
    },
  );

  test("rejects malformed and empty successful responses", async () => {
    for (const payload of [
      {},
      { choices: [{ message: { content: "   " } }] },
    ]) {
      const provider = createGroqHelpProvider({
        apiKey: "secret",
        fetcher: vi.fn<typeof fetch>().mockResolvedValue(
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      });
      await expect(
        provider.answer({ question: "Pregunta", sections }),
      ).rejects.toBeInstanceOf(HelpProviderUnavailableError);
    }
  });

  test("does not require configuration until an answer is requested", async () => {
    const provider = createGroqHelpProvider({ apiKey: undefined });
    await expect(
      provider.answer({ question: "Pregunta", sections }),
    ).rejects.toBeInstanceOf(HelpProviderUnavailableError);
  });
});
