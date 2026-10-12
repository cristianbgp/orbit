export type HelpActor = {
  userId: string;
  organizationId: string;
};

export type BlueprintSection = {
  document: string;
  heading: string;
  content: string;
  normalizedTerms: string[];
};

export type HelpSource = {
  document: string;
  section: string;
};

export type HelpAnswerProvider = {
  answer(input: {
    question: string;
    sections: BlueprintSection[];
  }): Promise<string>;
};

export type HelpRateLimiter = {
  consume(userId: string): boolean;
};

export type HelpAssistantResult = {
  answer: string;
  sources: HelpSource[];
};
