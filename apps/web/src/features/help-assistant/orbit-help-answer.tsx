import { lazy, Suspense } from "react";
import { BookOpen, MessageCircleQuestion, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { OrbitHelpResponse } from "@/lib/api/generated/models";

const Markdown = lazy(() => import("./orbit-help-markdown"));

export function OrbitHelpAnswer({
  question,
  response,
  onReset,
}: {
  question: string;
  response: OrbitHelpResponse;
  onReset(): void;
}) {
  return (
    <section aria-labelledby="orbit-help-answer-title" className="space-y-6">
      <div className="border-border bg-muted/25 rounded-lg border p-4">
        <p className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
          <MessageCircleQuestion aria-hidden="true" className="size-4" />
          Tu pregunta
        </p>
        <p className="mt-2 text-sm leading-6 font-medium">{question}</p>
      </div>

      <article aria-labelledby="orbit-help-answer-title">
        <p
          id="orbit-help-answer-title"
          className="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
        >
          Respuesta basada en la documentación
        </p>
        <div className="border-primary mt-3 min-w-0 border-l-2 pl-4">
          <Suspense
            fallback={
              <p role="status" className="text-muted-foreground text-sm">
                Preparando respuesta…
              </p>
            }
          >
            <Markdown>{response.answer}</Markdown>
          </Suspense>
        </div>
      </article>

      {response.sources.length > 0 ? (
        <div className="border-border bg-muted/35 rounded-lg border p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <BookOpen aria-hidden="true" className="text-primary size-4" />
            Fuentes consultadas
          </p>
          <ul className="text-muted-foreground mt-3 space-y-2 text-sm">
            {response.sources.map((source) => (
              <li
                key={`${source.document}:${source.section}`}
                className="min-w-0"
              >
                <span className="text-foreground font-medium break-all">
                  {source.document}
                </span>
                <span aria-hidden="true"> · </span>
                <span>{source.section}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Button variant="outline" onClick={onReset}>
        <RotateCcw aria-hidden="true" />
        Hacer otra pregunta
      </Button>
    </section>
  );
}
