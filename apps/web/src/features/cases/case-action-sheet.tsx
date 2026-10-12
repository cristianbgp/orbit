import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { CaseActionEntry } from "@/lib/api/generated/models/caseActionEntry";
import {
  CaseActionAssigneePicker,
  type CaseActionAssigneeMember,
} from "./case-action-assignee-picker";
import {
  CaseSheetContext,
  type CaseSheetContextValue,
} from "./case-sheet-context";

export function CaseActionSheet({
  open,
  action,
  members,
  busy,
  error,
  caseContext,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  action: CaseActionEntry | null;
  members: CaseActionAssigneeMember[];
  busy: boolean;
  error: string | null;
  caseContext?: CaseSheetContextValue;
  onOpenChange(open: boolean): void;
  onSubmit(values: {
    description: string;
    assigneeUserId: string | null;
  }): Promise<void>;
}) {
  const [description, setDescription] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setDescription(action?.description ?? "");
    setAssigneeUserId(action?.assignee?.userId ?? null);
    setValidation(null);
  }, [action, open]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = description.trim();
    if (!normalized) return setValidation("Escribe una descripción.");
    if (normalized.length > 1_000)
      return setValidation("La descripción no puede superar 1000 caracteres.");
    setValidation(null);
    await onSubmit({ description: normalized, assigneeUserId });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto overscroll-contain sm:max-w-md">
        <SheetHeader className="border-border border-b pr-16">
          <SheetTitle className="font-display text-xl">
            {action ? "Editar acción" : "Nueva acción"}
          </SheetTitle>
          <SheetDescription className="leading-6">
            Define el siguiente paso del caso y, si corresponde, asígnalo a un
            integrante de su equipo.
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
            <div className="space-y-2">
              <label
                htmlFor="case-action-description"
                className="block text-sm font-semibold"
              >
                Descripción
              </label>
              <Textarea
                id="case-action-description"
                autoFocus
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={1_000}
                rows={6}
                placeholder="Describe la acción pendiente"
                aria-invalid={Boolean(validation || error)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter")
                    event.currentTarget.form?.requestSubmit();
                }}
              />
              <p className="text-muted-foreground text-right text-xs">
                {description.length}/1000
              </p>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold">
                Encargado{" "}
                <span className="text-muted-foreground font-normal">
                  (opcional)
                </span>
              </label>
              <CaseActionAssigneePicker
                members={members}
                value={assigneeUserId}
                onChange={setAssigneeUserId}
              />
              {!members.length ? (
                <p className="text-muted-foreground text-xs">
                  Añade miembros al equipo del caso para poder asignarles
                  acciones.
                </p>
              ) : null}
            </div>
            {validation || error ? (
              <p role="alert" className="text-danger text-sm">
                {validation ?? error}
              </p>
            ) : null}
          </div>
          <SheetFooter className="border-border border-t pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button type="submit" disabled={busy}>
              {busy ? "Guardando…" : "Guardar acción"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
