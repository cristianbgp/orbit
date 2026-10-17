import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PreAppAccountBar,
  type PreAppAccountControls,
} from "@/features/auth/pre-app-account-controls";
import {
  OrganizationOnboardingError,
  validateOrganizationName,
} from "@/features/organization/organization-onboarding";
import { useDesktopAutofocus } from "@/hooks/use-desktop-autofocus";

type OrganizationOnboardingPageProps = {
  userName: string;
  account: PreAppAccountControls;
  onCreate(name: string): Promise<void>;
};

const CREATE_ERROR = "No pudimos crear el estudio. Inténtalo nuevamente.";

export function OrganizationOnboardingPage({
  userName,
  account,
  onCreate,
}: OrganizationOnboardingPageProps) {
  const [name, setName] = useState(`Estudio de ${userName}`);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useDesktopAutofocus(inputRef, { select: true });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    const normalizedName = name.trim();
    const validationError = validateOrganizationName(normalizedName);

    if (validationError) {
      setError(validationError);
      inputRef.current?.focus();
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await onCreate(normalizedName);
    } catch (requestError) {
      setError(
        requestError instanceof OrganizationOnboardingError
          ? requestError.message
          : CREATE_ERROR,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-[100dvh] px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto w-full max-w-5xl space-y-10">
        <PreAppAccountBar account={account} />
        <div className="grid items-center gap-10 md:grid-cols-[minmax(0,0.82fr)_minmax(22rem,1fr)] md:gap-16">
          <section className="max-w-md space-y-6">
            <div className="space-y-4">
              <h1 className="font-display text-3xl leading-tight font-semibold tracking-[-0.04em] sm:text-4xl">
                Empecemos por tu estudio.
              </h1>
              <p className="text-muted-foreground max-w-sm text-base leading-7">
                Tu estudio será el espacio para organizar clientes, proyectos y
                colaboración.
              </p>
            </div>
          </section>

          <section
            aria-labelledby="organization-form-title"
            className="rounded-card border-border bg-card shadow-panel border p-6 sm:p-8"
          >
            <form className="space-y-6" noValidate onSubmit={handleSubmit}>
              <div className="space-y-2">
                <h2
                  id="organization-form-title"
                  className="font-display text-xl font-semibold tracking-[-0.025em]"
                >
                  Crea tu estudio
                </h2>
                <p className="text-muted-foreground text-sm leading-6">
                  Podrás completar los demás datos más adelante.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="organization-name"
                  className="text-foreground block text-sm font-semibold"
                >
                  Nombre del estudio
                </label>
                <Input
                  id="organization-name"
                  ref={inputRef}
                  autoComplete="organization"
                  aria-describedby={
                    error ? "organization-name-error" : undefined
                  }
                  aria-invalid={Boolean(error)}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (error) setError(null);
                  }}
                />
                {error ? (
                  <p
                    id="organization-name-error"
                    role="alert"
                    className="rounded-control border-danger/20 bg-danger-soft text-danger border px-3 py-2 text-sm leading-5"
                  >
                    {error}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm leading-5">
                    Este nombre será visible para las personas de tu equipo.
                  </p>
                )}
              </div>

              <Button
                className="w-full active:translate-y-px"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creando estudio…" : "Crear estudio"}
              </Button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
