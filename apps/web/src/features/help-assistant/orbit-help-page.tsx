import { useRef, useState } from "react";
import { BookOpenCheck, MessageCircleQuestion, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AppPage, AppPageContent } from "@/features/layout/app-page";
import { AppPageHeader } from "@/features/layout/app-page-header";
import { useAskOrbitHelp } from "@/lib/api/generated/orbit-help/orbit-help";
import type { OrbitHelpResponse } from "@/lib/api/generated/models";
import { ApiClientError } from "@/lib/api/fetcher";
import { useDesktopAutofocus } from "@/hooks/use-desktop-autofocus";

import { OrbitHelpAnswer } from "./orbit-help-answer";
import { OrbitHelpForm } from "./orbit-help-form";

const suggestions = [
  "¿Cómo funciona la fecha final de un proyecto?",
  "¿Qué aparece en Mi trabajo?",
  "¿Cómo se archivan las tareas y los proyectos?",
];

function requestErrorMessage(error: unknown) {
  if (error instanceof ApiClientError && error.status === 429) {
    return "Alcanzaste el límite temporal de preguntas. Espera un momento antes de reintentar.";
  }
  if (error instanceof ApiClientError && error.status === 503) {
    return "Preguntar a Orbit no está disponible temporalmente. Inténtalo nuevamente en unos minutos.";
  }
  if (error instanceof ApiClientError && error.status === 403) {
    return "Preguntar a Orbit ya no está habilitado para este estudio.";
  }
  return "No pudimos consultar la documentación. Revisa tu conexión e inténtalo nuevamente.";
}

export function OrbitHelpPage() {
  const ask = useAskOrbitHelp();
  const questionInputRef = useRef<HTMLTextAreaElement>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<OrbitHelpResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  useDesktopAutofocus(questionInputRef);

  async function submit() {
    if (isSubmitting) return;
    const normalizedQuestion = question.trim();
    if (normalizedQuestion.length < 2) {
      setError("Escribe una pregunta de al menos 2 caracteres.");
      return;
    }
    if (normalizedQuestion.length > 500) {
      setError("La pregunta no puede superar los 500 caracteres.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const response = await ask.mutateAsync({
        data: { question: normalizedQuestion },
      });
      setAnswer(response);
    } catch (requestError) {
      setError(requestErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  function reset() {
    setQuestion("");
    setAnswer(null);
    setError(null);
  }

  return (
    <AppPage>
      <AppPageHeader
        icon={MessageCircleQuestion}
        eyebrow="Ayuda de producto"
        title="Preguntar a Orbit"
        description="Resuelve dudas sobre el funcionamiento de Orbit usando únicamente la documentación del producto."
      />

      <AppPageContent>
        <section
          aria-label="Asistente documental"
          className="w-full max-w-3xl min-w-0"
        >
          <div className="border-border bg-card shadow-panel rounded-card border p-4 sm:p-6">
            {answer ? (
              <OrbitHelpAnswer
                question={question.trim()}
                response={answer}
                onReset={reset}
              />
            ) : (
              <>
                <div className="border-primary/15 bg-primary-soft/40 mb-6 flex gap-3 rounded-lg border p-4">
                  <BookOpenCheck
                    aria-hidden="true"
                    className="text-primary mt-0.5 size-5 shrink-0"
                  />
                  <p className="text-muted-foreground text-sm leading-6">
                    Este asistente no consulta datos de tu estudio ni de tus
                    proyectos. Si la respuesta no está documentada, te lo
                    indicará.
                  </p>
                </div>

                <OrbitHelpForm
                  question={question}
                  error={error}
                  isSubmitting={isSubmitting}
                  questionInputRef={questionInputRef}
                  onQuestionChange={(value) => {
                    setQuestion(value);
                    if (error) setError(null);
                  }}
                  onSubmit={() => void submit()}
                />

                <div className="border-border mt-6 border-t pt-5">
                  <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Puedes preguntar
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {suggestions.map((suggestion) => (
                      <Button
                        key={suggestion}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto max-w-full justify-start py-2 text-left whitespace-normal"
                        disabled={isSubmitting}
                        onClick={() => {
                          setQuestion(suggestion);
                          setError(null);
                          questionInputRef.current?.focus();
                        }}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>

                {error &&
                (error.includes("límite temporal") ||
                  error.includes("temporalmente") ||
                  error.includes("conexión")) ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4"
                    disabled={isSubmitting}
                    onClick={() => void submit()}
                  >
                    <RotateCcw aria-hidden="true" />
                    Reintentar
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </section>
      </AppPageContent>
    </AppPage>
  );
}
