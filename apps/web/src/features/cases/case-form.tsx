import { Banknote, FileText, Scale, Tags, Users } from "lucide-react";
import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

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
import { ClientSelector } from "@/features/projects/client-selector";
import { useGetCaseOptions } from "@/lib/api/generated/cases/cases";
import type {
  CaseInput,
  CaseInputPeriod,
  ProjectClient,
} from "@/lib/api/generated/models";
import { CaseMemberPicker } from "./case-member-picker";
import { CasePeriodPicker } from "./case-period-picker";

type Initial = Partial<CaseInput> & {
  client?: ProjectClient;
  periodKind?: "year" | "month" | "month_range" | null;
  periodStart?: string | null;
  periodEnd?: string | null;
};
type Errors = {
  identification?: string;
  client?: string;
  amount?: string;
  period?: string;
  result?: string;
};

function readPeriod(value?: Initial): CaseInputPeriod {
  if (!value?.periodKind || !value.periodStart || !value.periodEnd) return null;
  if (value.periodKind === "year")
    return { kind: "year", year: Number(value.periodStart.slice(0, 4)) };
  if (value.periodKind === "month")
    return { kind: "month", month: value.periodStart.slice(0, 7) };
  return {
    kind: "month_range",
    startMonth: value.periodStart.slice(0, 7),
    endMonth: value.periodEnd.slice(0, 7),
  };
}

export function CaseForm({
  onSubmit,
  onCancel,
  pending = false,
  initial,
  disabled = false,
}: {
  onSubmit(input: CaseInput): Promise<void>;
  onCancel?: () => void;
  pending?: boolean;
  initial?: Initial;
  disabled?: boolean;
}) {
  const options = useGetCaseOptions();
  const identificationRef = useRef<HTMLInputElement>(null);
  const [client, setClient] = useState<ProjectClient | null>(
    initial?.client ?? null,
  );
  const [identification, setIdentification] = useState(
    initial?.identification ?? "",
  );
  const [type, setType] = useState<string>(initial?.type ?? "none");
  const [subtype, setSubtype] = useState<string>(initial?.subtype ?? "none");
  const [stage, setStage] = useState<string>(initial?.stage ?? "none");
  const [status, setStatus] = useState<string>(
    initial?.status ?? "in_progress",
  );
  const [result, setResult] = useState<string>(initial?.result ?? "none");
  const [entity, setEntity] = useState<string>(initial?.entity ?? "none");
  const [tax, setTax] = useState<string>(initial?.tax ?? "none");
  const [docket, setDocket] = useState(initial?.docketNumber ?? "");
  const [claimantType, setClaimantType] = useState<string>(
    initial?.claimantType ?? "client",
  );
  const [matter, setMatter] = useState(initial?.disputedMatter ?? "");
  const [resolution, setResolution] = useState(
    initial?.challengedResolution ?? "",
  );
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [currency, setCurrency] = useState<string>(initial?.currency ?? "none");
  const [period, setPeriod] = useState<CaseInputPeriod>(() =>
    readPeriod(initial),
  );
  const [members, setMembers] = useState(initial?.initialMemberUserIds ?? []);
  const [followers, setFollowers] = useState(
    initial?.initialFollowerUserIds ?? [],
  );
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const optionsUnavailable = options.isPending || options.isError;
  const subtypes = useMemo(
    () => options.data?.subtypes.filter((item) => item.type === type) ?? [],
    [options.data, type],
  );
  const stages = useMemo(
    () => options.data?.stages.filter((item) => item.type === type) ?? [],
    [options.data, type],
  );
  const busy = pending || submitting;

  function validate() {
    const next: Errors = {};
    if (!identification.trim())
      next.identification = "Ingresa la identificación del caso.";
    else if (identification.trim().length < 2)
      next.identification = "Ingresa al menos 2 caracteres.";
    if (!client) next.client = "Selecciona un cliente.";
    if (
      (amount.trim() && currency === "none") ||
      (!amount.trim() && currency !== "none")
    )
      next.amount = "Completa el importe y la moneda juntos.";
    if (period?.kind === "month_range" && period.startMonth > period.endMonth)
      next.period = "El final del período no puede ser anterior al inicio.";
    if (status === "concluded" && result === "none")
      next.result = "Selecciona el resultado del caso concluido.";
    return next;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || disabled) return;
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      if (nextErrors.identification) identificationRef.current?.focus();
      return;
    }
    if (!client) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await onSubmit({
        clientId: client.id,
        identification: identification.trim(),
        type: type === "none" ? null : (type as never),
        subtype: subtype === "none" ? null : (subtype as never),
        stage: stage === "none" ? null : (stage as never),
        entity: entity === "none" ? null : (entity as never),
        docketNumber: stage === "none" ? null : docket.trim() || null,
        tax: tax === "none" ? null : (tax as never),
        period,
        amount: amount.trim() || null,
        currency: currency === "none" ? null : (currency as never),
        claimantType: type === "judicial" ? (claimantType as never) : null,
        disputedMatter: matter.trim() || null,
        challengedResolution: resolution.trim() || null,
        status: status as never,
        result: result === "none" ? null : (result as never),
        ...(!initial && members.length
          ? { initialMemberUserIds: members }
          : {}),
        ...(!initial && followers.length
          ? { initialFollowerUserIds: followers }
          : {}),
      });
    } catch {
      setFormError("No pudimos guardar el caso. Inténtalo nuevamente.");
    } finally {
      setSubmitting(false);
    }
  }

  const select = (
    id: string,
    label: string,
    value: string,
    change: (value: string) => void,
    items: Array<{ value: string; label: string }>,
    config?: { optional?: boolean; inactive?: boolean; error?: string },
  ) => (
    <Field label={label} htmlFor={id} error={config?.error}>
      <Select
        value={value}
        disabled={disabled || config?.inactive}
        onValueChange={change}
      >
        <SelectTrigger
          id={id}
          aria-invalid={Boolean(config?.error)}
          className="!h-11 w-full"
        >
          <SelectValue placeholder="Selecciona una opción" />
        </SelectTrigger>
        <SelectContent>
          {config?.optional !== false ? (
            <SelectItem value="none">Sin definir</SelectItem>
          ) : value === "none" ? (
            <SelectItem value="none" disabled>
              Selecciona una opción
            </SelectItem>
          ) : null}
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );

  return (
    <form noValidate onSubmit={submit}>
      {options.isPending ? (
        <div
          role="status"
          className="border-border bg-muted/45 border-b px-5 py-4 text-sm sm:px-7"
        >
          Cargando opciones del caso…
        </div>
      ) : options.isError ? (
        <div
          role="alert"
          className="border-danger/20 bg-danger-soft border-b px-5 py-4 sm:px-7"
        >
          <p className="text-danger text-sm font-medium">
            No pudimos cargar las opciones del caso.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void options.refetch()}
          >
            Intentar de nuevo
          </Button>
        </div>
      ) : null}
      <fieldset disabled={disabled || optionsUnavailable} className="contents">
        <FormSection
          icon={Scale}
          title="Datos principales"
          description="Identifica el caso y el cliente al que pertenece."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Identificación del caso"
              htmlFor="case-identification"
              error={errors.identification}
            >
              <Input
                id="case-identification"
                ref={identificationRef}
                maxLength={500}
                aria-invalid={Boolean(errors.identification)}
                placeholder="Ej. Proceso tributario del período 2024"
                value={identification}
                onChange={(event) => {
                  setIdentification(event.target.value);
                  setErrors((current) => ({
                    ...current,
                    identification: undefined,
                  }));
                }}
              />
            </Field>
            <Field label="Cliente" htmlFor="case-client">
              <ClientSelector
                id="case-client"
                value={client}
                error={errors.client}
                onChange={(next) => {
                  setClient(next);
                  setErrors((current) => ({ ...current, client: undefined }));
                }}
              />
            </Field>
          </div>
        </FormSection>
        <FormSection
          icon={Tags}
          title="Clasificación"
          description="Ordena el caso usando los catálogos procesales del estudio."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {select(
              "case-type",
              "Tipo",
              type,
              (next) => {
                setType(next);
                setSubtype("none");
                setStage("none");
                setDocket("");
                setClaimantType("client");
              },
              options.data?.types ?? [],
            )}
            {select("case-subtype", "Subtipo", subtype, setSubtype, subtypes, {
              inactive: type === "none",
            })}
            {select("case-stage", "Etapa actual", stage, setStage, stages, {
              inactive: type === "none",
            })}
            {stage !== "none" ? (
              <Field
                label="Número de expediente"
                htmlFor="case-docket"
                optional
              >
                <Input
                  id="case-docket"
                  placeholder="Ej. EXP-2026-001"
                  value={docket}
                  onChange={(event) => setDocket(event.target.value)}
                />
              </Field>
            ) : null}
            {type === "judicial"
              ? select(
                  "case-claimant-type",
                  "Demandante",
                  claimantType,
                  setClaimantType,
                  [
                    {
                      value: "client",
                      label: client ? `Cliente: ${client.name}` : "Cliente",
                    },
                    { value: "sunat", label: "SUNAT" },
                  ],
                  { optional: false },
                )
              : null}
            {select(
              "case-entity",
              "Entidad",
              entity,
              setEntity,
              options.data?.entities ?? [],
            )}
            {select(
              "case-status",
              "Estado",
              status,
              (next) => {
                setStatus(next);
                if (next === "in_progress") setResult("none");
              },
              options.data?.statuses ?? [],
              { optional: false },
            )}
            {status === "concluded"
              ? select(
                  "case-result",
                  "Resultado",
                  result,
                  (next) => {
                    setResult(next);
                    setErrors((current) => ({ ...current, result: undefined }));
                  },
                  options.data?.results ?? [],
                  { optional: false, error: errors.result },
                )
              : null}
          </div>
        </FormSection>
        <FormSection
          icon={Banknote}
          title="Período e importe"
          description="Registra meses o años completos y el monto asociado al proceso."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {select(
              "case-tax",
              "Tributo",
              tax,
              setTax,
              options.data?.taxes ?? [],
            )}
            <CasePeriodPicker
              value={period}
              disabled={disabled}
              onChange={(next) => {
                setPeriod(next);
                setErrors((current) => ({ ...current, period: undefined }));
              }}
              error={errors.period}
            />
            <Field
              label="Importe"
              htmlFor="case-amount"
              optional
              error={errors.amount}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
                <Input
                  id="case-amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setErrors((current) => ({ ...current, amount: undefined }));
                  }}
                />
                <Select
                  value={currency}
                  onValueChange={(next) => {
                    setCurrency(next);
                    setErrors((current) => ({ ...current, amount: undefined }));
                  }}
                >
                  <SelectTrigger aria-label="Moneda" className="!h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Moneda</SelectItem>
                    {options.data?.currencies.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Field>
          </div>
        </FormSection>
        <FormSection
          icon={FileText}
          title="Información del proceso"
          description="Añade el contexto jurídico necesario para reconocer el caso."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Materia controvertida" htmlFor="case-matter" optional>
              <Textarea
                id="case-matter"
                rows={5}
                placeholder="Describe brevemente la controversia"
                value={matter}
                onChange={(event) => setMatter(event.target.value)}
              />
            </Field>
            <Field
              label="Resolución impugnada"
              htmlFor="case-resolution"
              optional
            >
              <Textarea
                id="case-resolution"
                rows={5}
                placeholder="Número o descripción de la resolución"
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
              />
            </Field>
          </div>
        </FormSection>
        {!initial ? (
          <FormSection
            icon={Users}
            title="Personas del caso"
            description="Opcional. Equipo y seguimiento son listas independientes; una persona puede estar en ambas."
          >
            <div className="grid items-start gap-6 xl:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold">Equipo inicial</h3>
                <p className="text-muted-foreground mt-1 mb-3 text-sm">
                  Personas que participarán en el trabajo del caso.
                </p>
                <CaseMemberPicker value={members} onChange={setMembers} />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Seguimiento inicial</h3>
                <p className="text-muted-foreground mt-1 mb-3 text-sm">
                  Personas que seguirán su estado y novedades.
                </p>
                <CaseMemberPicker value={followers} onChange={setFollowers} />
              </div>
            </div>
          </FormSection>
        ) : null}
        {formError ? (
          <p
            role="alert"
            className="rounded-control border-danger/20 bg-danger-soft text-danger mx-5 mb-5 border px-3 py-2 text-sm sm:mx-7"
          >
            {formError}
          </p>
        ) : null}
        <div className="border-border flex flex-col-reverse gap-2 border-t p-5 sm:flex-row sm:justify-end sm:p-7">
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
          ) : null}
          <Button
            type="submit"
            disabled={busy || disabled || optionsUnavailable}
            className="active:translate-y-px"
          >
            {busy ? "Guardando…" : initial ? "Guardar cambios" : "Crear caso"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

function FormSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Scale;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border border-b p-5 sm:p-7">
      <div className="mb-5 flex items-start gap-3">
        <span className="bg-primary-soft text-primary mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
function Field({
  label,
  htmlFor,
  optional,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-semibold">
          {label}
        </label>
        {optional ? (
          <span className="text-muted-foreground text-xs">Opcional</span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
