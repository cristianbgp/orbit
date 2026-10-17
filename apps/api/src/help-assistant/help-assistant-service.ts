import { HelpProviderUnavailableError } from "./groq-help-provider";
import type {
  BlueprintSection,
  HelpActor,
  HelpAnswerProvider,
  HelpAssistantResult,
  HelpRateLimiter,
} from "./help-assistant-types";

export type HelpAssistantServiceErrorCode =
  "HELP_RATE_LIMITED" | "HELP_PROVIDER_UNAVAILABLE";

export class HelpAssistantServiceError extends Error {
  readonly code: HelpAssistantServiceErrorCode;

  constructor(code: HelpAssistantServiceErrorCode, message: string) {
    super(message);
    this.name = "HelpAssistantServiceError";
    this.code = code;
  }
}

export type HelpAssistantService = {
  ask(actor: HelpActor, question: string): Promise<HelpAssistantResult>;
};

const INSUFFICIENT_ANSWER =
  "La documentación actual de Orbit no contiene suficiente información para responder esa pregunta.";

export function createHelpAssistantService(options: {
  retrieve(question: string): BlueprintSection[];
  provider: HelpAnswerProvider;
  limiter: HelpRateLimiter;
}): HelpAssistantService {
  return {
    async ask(actor, question) {
      const normalizedQuestion = question.trim();
      const sections = options.retrieve(normalizedQuestion);
      if (sections.length === 0)
        return { answer: INSUFFICIENT_ANSWER, sources: [] };

      if (!options.limiter.consume(actor.userId)) {
        throw new HelpAssistantServiceError(
          "HELP_RATE_LIMITED",
          "Alcanzaste el límite temporal de preguntas. Inténtalo más tarde.",
        );
      }

      try {
        const answer = await options.provider.answer({
          question: normalizedQuestion,
          sections,
        });
        const seen = new Set<string>();
        const sources = sections.flatMap((section) => {
          const key = `${section.document}:${section.heading}`;
          if (seen.has(key)) return [];
          seen.add(key);
          return [{ document: section.document, section: section.heading }];
        });
        return { answer, sources };
      } catch (error) {
        if (error instanceof HelpProviderUnavailableError) {
          throw new HelpAssistantServiceError(
            "HELP_PROVIDER_UNAVAILABLE",
            "Preguntar a Orbit no está disponible temporalmente.",
          );
        }
        throw error;
      }
    },
  };
}
