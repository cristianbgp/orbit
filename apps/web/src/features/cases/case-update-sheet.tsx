import { useEffect, useState } from "react";

import { DatePicker } from "@/components/ui/calendar-date-picker";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CaseUpdateEntry } from "@/lib/api/generated/models/caseUpdateEntry";
import type { CaseUpdateKind } from "@/lib/api/generated/models/caseUpdateKind";
import {
  CaseSheetContext,
  type CaseSheetContextValue,
} from "./case-sheet-context";

type ValidationError = {
  field: "date" | "description";
  message: string;
};

export function CaseUpdateSheet({
  open,
  update,
  busy,
  error,
  caseContext,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  update: CaseUpdateEntry | null;
  busy: boolean;
  error: string | null;
  caseContext?: CaseSheetContextValue;
  onOpenChange(open: boolean): void;
  onSubmit(values: {
    date: string;
    description: string;
    kind?: CaseUpdateKind;
  }): Promise<void>;
}) {
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<CaseUpdateKind>("update");
  const [validation, setValidation] = useState<ValidationError | null>(null);

  useEffect(() => {
    if (!open) return;
    setDate(update?.date ?? "");
    setDescription(update?.description ?? "");
    setKind(update?.kind ?? "update");
    setValidation(null);
  }, [open, update]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedDescription = description.trim();
    if (!date) {
      setValidation({
        field: "date",
        message: "Selecciona la fecha de la novedad.",
      });
      return;
    }
    if (!normalizedDescription) {
      setValidation({
        field: "description",
        message: "Escribe una descripción.",
      });
      return;
    }
    if (normalizedDescription.length > 5000) {
      setValidation({
        field: "description",
        message: "La descripción no puede superar 5000 caracteres.",
      });
      return;
    }
    setValidation(null);
    await onSubmit({
      date,
      description: normalizedDescription,
      ...(update ? { kind } : {}),
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto overscroll-contain sm:max-w-md">
        <SheetHeader className="border-border border-b pr-16">
          <SheetTitle className="font-display text-xl">
            {update ? "Editar novedad" : "Nueva novedad"}
          </SheetTitle>
          <SheetDescription className="leading-6">
            Registra un hecho relevante del caso en la fecha en que ocurrió.
          </SheetDescription>
          {caseContext ? (
            <CaseSheetContext
              value={caseContext}
              onNavigate={() => onOpenChange(false)}
            />
          ) : null}
        </SheetHeader>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
          <div className="flex-1 space-y-5 px-4 py-5">
            <DatePicker
              id="case-update-date"
              label="Fecha"
              value={date}
              onChange={(value) => {
                setDate(value);
                if (validation?.field === "date") setValidation(null);
              }}
              error={
                validation?.field === "date" ? validation.message : undefined
              }
              required
            />
            {update ? (
              <div className="space-y-2">
                <label className="block text-sm font-semibold">
                  Clasificación
                </label>
                <Select
                  value={kind}
                  onValueChange={(value) => setKind(value as CaseUpdateKind)}
                >
                  <SelectTrigger aria-label="Clasificación" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="update">Novedad</SelectItem>
                    <SelectItem value="background">Antecedente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <label
                htmlFor="case-update-description"
                className="block text-sm font-semibold"
              >
                Descripción
              </label>
              <Textarea
                id="case-update-description"
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  if (validation?.field === "description") {
                    setValidation(null);
                  }
                }}
                maxLength={5000}
                rows={7}
                placeholder="Describe la novedad procesal"
                aria-invalid={validation?.field === "description"}
              />
              <p className="text-muted-foreground text-right text-xs">
                {description.length}/5000
              </p>
              {validation?.field === "description" ? (
                <p role="alert" className="text-danger text-sm">
                  {validation.message}
                </p>
              ) : null}
            </div>
            {error ? (
              <p role="alert" className="text-danger text-sm">
                {error}
              </p>
            ) : null}
          </div>
          <SheetFooter className="border-border border-t pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button type="submit" disabled={busy}>
              {busy ? "Guardando…" : "Guardar novedad"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
