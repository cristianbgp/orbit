import { useRef, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCreateMemberPasswordRecoveryLink } from "@/lib/api/generated/team/team";

type RecoveryMember = {
  userId: string;
  name: string;
  email: string;
};

type MemberPasswordRecoveryDialogProps = {
  member: RecoveryMember | null;
  open: boolean;
  onOpenChange(open: boolean): void;
};

export function MemberPasswordRecoveryDialog({
  member,
  open,
  onOpenChange,
}: MemberPasswordRecoveryDialogProps) {
  const mutation = useCreateMemberPasswordRecoveryLink();
  const submitting = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function clearSensitiveState() {
    submitting.current = false;
    setIsSubmitting(false);
    setLink(null);
    setError(null);
    setCopied(false);
    mutation.reset();
  }

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) clearSensitiveState();
    onOpenChange(nextOpen);
  }

  async function generate() {
    if (!member || submitting.current) return;
    submitting.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await mutation.mutateAsync({ userId: member.userId });
      setLink(result.url);
    } catch {
      setError("No pudimos generar el enlace. Inténtalo nuevamente.");
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError("No pudimos copiar el enlace. Selecciónalo manualmente.");
    }
  }

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-lg"
      >
        <DialogHeader>
          <div className="bg-primary-soft text-primary-strong mb-1 flex size-11 items-center justify-center rounded-xl">
            <KeyRound aria-hidden="true" className="size-5" />
          </div>
          <DialogTitle className="font-display text-xl">
            Recuperar acceso
          </DialogTitle>
          <DialogDescription className="leading-6">
            Genera un enlace privado para que el miembro establezca una nueva
            contraseña.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-control border-border bg-muted/35 border p-4">
            <p className="font-medium">{member.name}</p>
            <p className="text-muted-foreground mt-1 text-sm break-all">
              {member.email}
            </p>
          </div>

          {link ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm leading-6">
                El enlace vence en 30 minutos y solo puede utilizarse una vez.
                Compártelo únicamente con la persona correcta.
              </p>
              <label className="block space-y-2 text-sm font-medium">
                <span>Enlace de recuperación</span>
                <Input
                  readOnly
                  value={link}
                  className="font-mono text-xs"
                  onFocus={(event) => event.currentTarget.select()}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full lg:h-9"
                onClick={() => void copyLink()}
              >
                {copied ? (
                  <Check aria-hidden="true" className="size-4" />
                ) : (
                  <Copy aria-hidden="true" className="size-4" />
                )}
                {copied ? "Enlace copiado" : "Copiar enlace"}
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm leading-6">
              El enlace vence en 30 minutos. Orbit nunca mostrará al propietario
              la contraseña que el miembro elija.
            </p>
          )}

          {error ? (
            <p
              role="alert"
              className="border-danger bg-danger-soft text-danger rounded-control border px-3 py-2 text-sm"
            >
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="h-11 lg:h-9">
              Cerrar
            </Button>
          </DialogClose>
          {!link ? (
            <Button
              type="button"
              className="h-11 lg:h-9"
              disabled={isSubmitting}
              onClick={() => void generate()}
            >
              {isSubmitting ? "Generando…" : "Generar enlace seguro"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
