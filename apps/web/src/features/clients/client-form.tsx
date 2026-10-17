import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Client, ClientInput } from "@/lib/api/generated/models";

type ClientFormProps = {
  initialClient?: Client;
  onSubmit(input: ClientInput): Promise<void> | void;
  onCancel(): void;
};

type FormValues = {
  type: "person" | "company";
  name: string;
  documentType: string;
  documentNumber: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
};

function initialValues(client?: Client): FormValues {
  return {
    type: client?.type ?? "person",
    name: client?.name ?? "",
    documentType: client?.documentType ?? "",
    documentNumber: client?.documentNumber ?? "",
    email: client?.email ?? "",
    phone: client?.phone ?? "",
    address: client?.address ?? "",
    notes: client?.notes ?? "",
  };
}

function compact(values: FormValues): ClientInput {
  const optional = (value: string) => value.trim() || undefined;

  return {
    type: values.type,
    name: values.name.trim(),
    documentType: optional(values.documentType),
    documentNumber: optional(values.documentNumber),
    email: optional(values.email),
    phone: optional(values.phone),
    address: optional(values.address),
    notes: optional(values.notes),
  };
}

export function ClientForm({
  initialClient,
  onSubmit,
  onCancel,
}: ClientFormProps) {
  const [values, setValues] = useState(() => initialValues(initialClient));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(initialClient);

  function setValue<Key extends keyof FormValues>(
    key: Key,
    value: FormValues[Key],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    if (error) setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const input = compact(values);
    if (input.name.length < 2) {
      setError("Ingresa al menos 2 caracteres.");
      nameRef.current?.focus();
      return;
    }
    if (input.name.length > 160) {
      setError("El nombre no puede superar 160 caracteres.");
      nameRef.current?.focus();
      return;
    }
    if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      setError("Ingresa un correo válido.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(input);
    } catch {
      setError("No pudimos guardar el cliente. Inténtalo nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form noValidate className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label htmlFor="client-type" className="block text-sm font-semibold">
          Tipo de cliente
        </label>
        <Select
          value={values.type}
          onValueChange={(value) =>
            setValue("type", value as FormValues["type"])
          }
        >
          <SelectTrigger id="client-type" className="!h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="person">Persona</SelectItem>
            <SelectItem value="company">Empresa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label htmlFor="client-name" className="block text-sm font-semibold">
          {values.type === "person" ? "Nombre completo" : "Razón social"}
        </label>
        <Input
          id="client-name"
          ref={nameRef}
          autoComplete={values.type === "company" ? "organization" : "name"}
          aria-invalid={Boolean(error)}
          value={values.name}
          onChange={(event) => setValue("name", event.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="client-document-type"
            className="block text-sm font-semibold"
          >
            Tipo de documento
          </label>
          <Input
            id="client-document-type"
            placeholder={values.type === "company" ? "RUC" : "DNI"}
            maxLength={30}
            value={values.documentType}
            onChange={(event) => setValue("documentType", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="client-document-number"
            className="block text-sm font-semibold"
          >
            Número de documento
          </label>
          <Input
            id="client-document-number"
            maxLength={30}
            value={values.documentNumber}
            onChange={(event) => setValue("documentNumber", event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="client-email" className="block text-sm font-semibold">
            Correo
          </label>
          <Input
            id="client-email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => setValue("email", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="client-phone" className="block text-sm font-semibold">
            Teléfono
          </label>
          <Input
            id="client-phone"
            type="tel"
            autoComplete="tel"
            maxLength={40}
            value={values.phone}
            onChange={(event) => setValue("phone", event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="client-address" className="block text-sm font-semibold">
          Dirección
        </label>
        <Input
          id="client-address"
          autoComplete="street-address"
          maxLength={300}
          value={values.address}
          onChange={(event) => setValue("address", event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="client-notes" className="block text-sm font-semibold">
          Notas internas
        </label>
        <Textarea
          id="client-notes"
          maxLength={2_000}
          value={values.notes}
          onChange={(event) => setValue("notes", event.target.value)}
        />
        <p className="text-muted-foreground text-xs leading-5">
          Solo serán visibles para las personas de tu estudio.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-control border-danger/20 bg-danger-soft text-danger border px-3 py-2 text-sm"
        >
          {error}
        </p>
      ) : null}

      <div className="border-border flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="active:translate-y-px"
        >
          {isSubmitting
            ? "Guardando…"
            : isEditing
              ? "Guardar cambios"
              : "Crear cliente"}
        </Button>
      </div>
    </form>
  );
}
