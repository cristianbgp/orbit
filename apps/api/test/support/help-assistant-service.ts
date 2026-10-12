import type { HelpAssistantService } from "../../src/help-assistant/help-assistant-service";

export const testHelpAssistantService: HelpAssistantService = {
  async ask() {
    return { answer: "Respuesta de ayuda", sources: [] };
  },
};
