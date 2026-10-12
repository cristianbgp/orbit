import type { FormEvent, KeyboardEvent, Ref } from "react";
import { ArrowUp, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type OrbitHelpFormProps = {
  question: string;
  error: string | null;
  isSubmitting: boolean;
  questionInputRef?: Ref<HTMLTextAreaElement>;
  onQuestionChange(question: string): void;
  onSubmit(): void;
};

export function OrbitHelpForm({
  question,
  error,
  isSubmitting,
  questionInputRef,
  onQuestionChange,
  onSubmit,
}: OrbitHelpFormProps) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  function submitFromKeyboard(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="orbit-help-question" className="text-sm font-semibold">
        Tu pregunta
      </label>
      <Textarea
        ref={questionInputRef}
        id="orbit-help-question"
        value={question}
        onChange={(event) => onQuestionChange(event.target.value)}
        onKeyDown={submitFromKeyboard}
        placeholder="Por ejemplo: ¿cómo se calculan las fechas del cronograma?"
        minLength={2}
        maxLength={500}
        rows={5}
        disabled={isSubmitting}
        aria-invalid={Boolean(error)}
        aria-describedby={`${error ? "orbit-help-error" : "orbit-help-count"} orbit-help-keyboard-hint`}
        className="min-h-32 resize-none"
      />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          {error ? (
            <p
              id="orbit-help-error"
              role="alert"
              className="text-danger text-sm"
            >
              {error}
            </p>
          ) : isSubmitting ? (
            <p role="status" className="text-muted-foreground text-sm">
              Consultando la documentación…
            </p>
          ) : (
            <p id="orbit-help-count" className="text-muted-foreground text-xs">
              {question.length}/500 caracteres
            </p>
          )}
          <p
            id="orbit-help-keyboard-hint"
            className="text-muted-foreground text-xs"
          >
            Enter para enviar · Shift + Enter para nueva línea
          </p>
        </div>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto"
        >
          {isSubmitting ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <ArrowUp aria-hidden="true" />
          )}
          Preguntar
        </Button>
      </div>
    </form>
  );
}
