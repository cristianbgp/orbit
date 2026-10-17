import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type AuthMode = "sign-in" | "sign-up";

export type AuthFormActions = {
  signIn(input: { email: string; password: string }): Promise<void>;
  signUp(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<void>;
};

type AuthFormProps = {
  mode: AuthMode;
  actions: AuthFormActions;
  onModeChange(mode: AuthMode): void;
};

const REQUEST_ERROR =
  "No pudimos completar la solicitud. Revisa tus datos e inténtalo otra vez.";

export function AuthForm({ mode, actions, onModeChange }: AuthFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSignUp = mode === "sign-up";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (isSignUp && password !== passwordConfirmation) {
      setError("Las contraseñas deben coincidir.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isSignUp) {
        await actions.signUp({
          name: name.trim(),
          email: email.trim(),
          password,
        });
      } else {
        await actions.signIn({ email: email.trim(), password });
      }
    } catch {
      setError(REQUEST_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  }

  const submitLabel = isSignUp
    ? isSubmitting
      ? "Creando cuenta…"
      : "Crear cuenta"
    : isSubmitting
      ? "Iniciando sesión…"
      : "Iniciar sesión";

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.035em]">
          {isSignUp ? "Crea tu cuenta" : "Bienvenido a Orbit"}
        </h1>
        <p className="text-muted-foreground text-sm leading-6">
          {isSignUp
            ? "Configura tu acceso para comenzar a organizar el trabajo legal."
            : "Ingresa para continuar con tus proyectos legales."}
        </p>
      </div>

      <div className="space-y-4">
        {isSignUp ? (
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Nombre completo</span>
            <Input
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
        ) : null}

        <label className="block space-y-1.5 text-sm font-medium">
          <span>Correo electrónico</span>
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-1.5 text-sm font-medium">
          <span>Contraseña</span>
          <Input
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </label>

        {isSignUp ? (
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Confirmar contraseña</span>
            <Input
              type="password"
              autoComplete="new-password"
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              aria-invalid={error === "Las contraseñas deben coincidir."}
              minLength={8}
              required
            />
          </label>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-control border-danger/20 bg-danger-soft text-danger border px-3 py-2 text-sm"
        >
          {error}
        </p>
      ) : null}

      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {submitLabel}
      </Button>

      {!isSignUp ? (
        <p className="text-muted-foreground text-center text-xs leading-5">
          ¿Olvidaste tu contraseña? Solicita un enlace al propietario de tu
          estudio.
        </p>
      ) : null}

      <p className="text-muted-foreground text-center text-sm">
        {isSignUp ? "¿Ya tienes una cuenta?" : "¿Aún no tienes una cuenta?"}{" "}
        <button
          type="button"
          className="text-primary focus-visible:ring-ring font-semibold underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:outline-none"
          onClick={() => onModeChange(isSignUp ? "sign-in" : "sign-up")}
        >
          {isSignUp ? "Inicia sesión" : "Crear una cuenta"}
        </button>
      </p>
    </form>
  );
}
