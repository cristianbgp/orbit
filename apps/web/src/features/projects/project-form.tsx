import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/calendar-date-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  Project,
  ProjectClient,
  ProjectInput,
  ProjectStatus,
  ProjectType,
} from "@/lib/api/generated/models";
import { ClientSelector } from "./client-selector";
import { PROJECT_STATUS_LABELS, PROJECT_TYPE_LABELS } from "./project-labels";
import {
  createInitialLegalEventDraft,
  InitialLegalEventsField,
  type InitialLegalEventDraft,
  type InitialLegalEventDraftErrors,
} from "./initial-legal-events-field";
import {
  ProjectInitialTeamSelector,
  type InitialTeamSelection,
} from "./project-initial-team-selector";

type ProjectFormProps = {
  initialProject?: Project;
  onSubmit(input: ProjectInput): Promise<void> | void;
  onCancel?: () => void;
};

type FormValues = {
  name: string;
  client: ProjectClient | null;
  type: ProjectType | "";
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  legalEvents: InitialLegalEventDraft[];
  internalReference: string;
  description: string;
  initialTeam: InitialTeamSelection[];
};

type FormErrors = Partial<Record<keyof FormValues, string>> & {
  legalEventRows?: Record<string, InitialLegalEventDraftErrors>;
};

function initialValues(project: Project | undefined): FormValues {
  return {
    name: project?.name ?? "",
    client: project?.client ?? null,
    type: project?.type ?? "",
    status: project?.status ?? "draft",
    startDate: project?.startDate ?? "",
    endDate: project?.endDate ?? "",
    legalEvents: [createInitialLegalEventDraft("legal-event-1")],
    internalReference: project?.internalReference ?? "",
    description: project?.description ?? "",
    initialTeam: [],
  };
}

function compact(values: FormValues): ProjectInput {
  const optional = (value: string) => value.trim() || undefined;
  const initialLegalEvents = values.legalEvents
    .filter((event) => !legalEventIsUntouched(event))
    .map((event) => ({
      title: event.title.trim(),
      date: event.date,
      ...(optional(event.description)
        ? { description: optional(event.description) }
        : {}),
    }));

  return {
    name: values.name.trim(),
    clientId: values.client?.id ?? "",
    type: values.type as ProjectType,
    status: values.status,
    startDate: values.startDate,
    endDate: values.endDate,
    internalReference: optional(values.internalReference),
    description: optional(values.description),
    ...(initialLegalEvents.length === 0 ? {} : { initialLegalEvents }),
    ...(values.initialTeam.length === 0
      ? {}
      : {
          initialAssignments: values.initialTeam.map(
            ({ member, responsibility }) => ({
              userId: member.userId,
              responsibility,
            }),
          ),
        }),
  };
}

function legalEventIsUntouched(event: InitialLegalEventDraft) {
  return (
    event.title === "Fecha legal" && !event.date && !event.description.trim()
  );
}

function validate(values: FormValues): FormErrors {
  if (values.name.trim().length === 0) {
    return { name: "Ingresa el nombre del proyecto." };
  }
  if (values.name.trim().length < 2) {
    return { name: "Ingresa al menos 2 caracteres." };
  }
  if (!values.client) return { client: "Selecciona un cliente." };
  if (!values.type) return { type: "Selecciona el tipo de proyecto." };
  if (!values.startDate) return { startDate: "Selecciona la fecha de inicio." };
  if (!values.endDate) return { endDate: "Selecciona la fecha final." };
  if (values.startDate > values.endDate) {
    return {
      endDate: "La fecha final no puede ser anterior a la fecha de inicio.",
    };
  }
  const legalEventRows: Record<string, InitialLegalEventDraftErrors> = {};
  for (const event of values.legalEvents) {
    if (legalEventIsUntouched(event)) continue;
    const eventErrors: InitialLegalEventDraftErrors = {};
    if (event.title.trim().length < 2) {
      eventErrors.title = "Ingresa un nombre para el evento legal.";
    }
    if (!event.date) {
      eventErrors.date = "Selecciona una fecha para el evento legal.";
    } else if (event.date < values.startDate) {
      eventErrors.date =
        "La fecha legal no puede ser anterior al inicio del proyecto.";
    }
    if (Object.keys(eventErrors).length > 0) {
      legalEventRows[event.id] = eventErrors;
    }
  }
  if (Object.keys(legalEventRows).length > 0) {
    return { legalEventRows };
  }
  return {};
}

export function ProjectForm({
  initialProject,
  onSubmit,
  onCancel,
}: ProjectFormProps) {
  const [values, setValues] = useState(() => initialValues(initialProject));
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(initialProject);

  function setValue<Key extends keyof FormValues>(
    key: Key,
    value: FormValues[Key],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setFormError(null);
  }

  function setLegalEvents(legalEvents: InitialLegalEventDraft[]) {
    setValues((current) => ({ ...current, legalEvents }));
    setErrors((current) => ({ ...current, legalEventRows: undefined }));
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const nextErrors = validate(values);
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0] as
      keyof FormValues | undefined;
    if (firstError) {
      if (firstError === "name") nameRef.current?.focus();
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(compact(values));
    } catch {
      setFormError("No pudimos guardar el proyecto. Inténtalo nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form noValidate className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label htmlFor="project-name" className="block text-sm font-semibold">
          Nombre del proyecto
        </label>
        <Input
          id="project-name"
          ref={nameRef}
          maxLength={160}
          aria-invalid={Boolean(errors.name)}
          value={values.name}
          onChange={(event) => setValue("name", event.target.value)}
        />
        {errors.name ? (
          <p role="alert" className="text-danger text-sm">
            {errors.name}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="project-client" className="block text-sm font-semibold">
          Cliente
        </label>
        <ClientSelector
          id="project-client"
          value={values.client}
          error={errors.client}
          onChange={(client) => setValue("client", client)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="project-type" className="block text-sm font-semibold">
            Tipo de proyecto
          </label>
          <Select
            aria-invalid={Boolean(errors.type)}
            value={values.type}
            onValueChange={(value) =>
              setValue("type", value as FormValues["type"])
            }
          >
            <SelectTrigger
              id="project-type"
              className="!h-11 w-full"
              aria-invalid={Boolean(errors.type)}
            >
              <SelectValue placeholder="Selecciona un tipo" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.type ? (
            <p role="alert" className="text-danger text-sm">
              {errors.type}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="project-status"
            className="block text-sm font-semibold"
          >
            Estado
          </label>
          <Select
            value={values.status}
            onValueChange={(value) =>
              setValue("status", value as ProjectStatus)
            }
          >
            <SelectTrigger id="project-status" className="!h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        <DateRangePicker
          id="project-period"
          label="Periodo del proyecto"
          description="Fecha de inicio y fecha final del trabajo."
          from={values.startDate}
          to={values.endDate}
          error={errors.startDate ?? errors.endDate}
          onChange={({ from, to }) => {
            setValues((current) => ({
              ...current,
              startDate: from,
              endDate: to,
            }));
            setErrors((current) => ({
              ...current,
              startDate: undefined,
              endDate: undefined,
            }));
            setFormError(null);
          }}
        />
        {!isEditing ? (
          <InitialLegalEventsField
            value={values.legalEvents}
            projectStartDate={values.startDate}
            errors={errors.legalEventRows}
            onChange={setLegalEvents}
          />
        ) : null}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="project-reference"
          className="block text-sm font-semibold"
        >
          Referencia interna
        </label>
        <Input
          id="project-reference"
          maxLength={80}
          value={values.internalReference}
          onChange={(event) =>
            setValue("internalReference", event.target.value)
          }
        />
        <p className="text-muted-foreground text-xs">Opcional</p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="project-description"
          className="block text-sm font-semibold"
        >
          Descripción
        </label>
        <Textarea
          id="project-description"
          maxLength={2_000}
          value={values.description}
          onChange={(event) => setValue("description", event.target.value)}
        />
        <p className="text-muted-foreground text-xs">Opcional</p>
      </div>

      {!isEditing ? (
        <div className="space-y-2">
          <div>
            <p className="text-sm font-semibold">Equipo inicial</p>
            <p className="text-muted-foreground text-xs">
              Opcional. Añade integrantes y define quiénes supervisarán el
              proyecto.
            </p>
          </div>
          <ProjectInitialTeamSelector
            value={values.initialTeam}
            onChange={(initialTeam) => setValue("initialTeam", initialTeam)}
          />
        </div>
      ) : null}

      {formError ? (
        <p
          role="alert"
          className="rounded-control border-danger/20 bg-danger-soft text-danger border px-3 py-2 text-sm"
        >
          {formError}
        </p>
      ) : null}

      <div className="border-border flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="active:translate-y-px"
        >
          {isSubmitting
            ? "Guardando…"
            : isEditing
              ? "Guardar cambios"
              : "Crear proyecto"}
        </Button>
      </div>
    </form>
  );
}
