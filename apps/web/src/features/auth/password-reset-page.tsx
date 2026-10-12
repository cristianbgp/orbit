import { useEffect, useRef, useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { useDesktopAutofocus } from "@/hooks/use-desktop-autofocus";

type PasswordResetPageProps = {
  token: string | null;
  onComplete(): void;
};

const INVALID_LINK_MESSAGE = "Este enlace no es válido o ya venció.";

export function PasswordResetPage({
  token,
  onComplete,
}: PasswordResetPageProps) {
  const passwordRef = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    token ? null : INVALID_LINK_MESSAGE,
  );

  useDesktopAutofocus(passwordRef);

  useEffect(() => {
    setError(token ? null : INVALID_LINK_MESSAGE);
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || submitting.current) return;

    setError(null);
    if (password !== confirmation) {
      setError("Las contraseñas deben coincidir.");
      return;
    }

    submitting.current = true;
    setIsSubmitting(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (result.error) {
        setError(INVALID_LINK_MESSAGE);
        return;
      }
      onComplete();
    } catch {
      setError(INVALID_LINK_MESSAGE);
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={submit}>
      <div className="space-y-4">
        <div className="bg-primary-soft text-primary-strong flex size-12 items-center justify-center rounded-xl">
          <KeyRound aria-hidden="true" className="size-5" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.035em]">
            Define una nueva contraseña
          </h1>
          <p className="text-muted-foreground text-sm leading-6">
            Utiliza al menos 8 caracteres. Al guardarla, tus otras sesiones se
            cerrarán por seguridad.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <label className="block space-y-1.5 text-sm font-medium">
          <span>Nueva contraseña</span>
          <Input
            ref={passwordRef}
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label className="block space-y-1.5 text-sm font-medium">
          <span>Confirmar contraseña</span>
          <Input
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirmation}
            aria-invalid={error === "Las contraseñas deben coincidir."}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
      </div>

      {error ? (
        <p
          role="alert"
          className="border-danger/20 bg-danger-soft text-danger rounded-control border px-3 py-2 text-sm"
        >
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        className="h-11 w-full lg:h-9"
        disabled={!token || isSubmitting}
      >
        {isSubmitting ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
