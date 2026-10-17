import { CalendarDays, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CaseInputPeriod } from "@/lib/api/generated/models";
import { formatCasePeriod } from "./case-presenters";

const months = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const currentYear = new Date().getUTCFullYear();
const years = Array.from({ length: currentYear - 1899 + 10 }, (_, index) =>
  String(currentYear + 10 - index),
);
const monthValue = (year: string, month: string) => `${year}-${month}`;
const splitMonth = (value?: string) => ({
  year: value?.slice(0, 4) ?? String(currentYear),
  month: value?.slice(5, 7) ?? "01",
});

export function CasePeriodPicker({
  value,
  onChange,
  disabled = false,
  error,
}: {
  value: CaseInputPeriod;
  onChange(value: CaseInputPeriod): void;
  disabled?: boolean;
  error?: string;
}) {
  const initialStart =
    value?.kind === "month"
      ? splitMonth(value.month)
      : value?.kind === "month_range"
        ? splitMonth(value.startMonth)
        : splitMonth();
  const initialEnd =
    value?.kind === "month_range" ? splitMonth(value.endMonth) : initialStart;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"year" | "month" | "month_range">(
    value?.kind ?? "year",
  );
  const [startYear, setStartYear] = useState(
    value?.kind === "year" ? String(value.year) : initialStart.year,
  );
  const [startMonth, setStartMonth] = useState(initialStart.month);
  const [endYear, setEndYear] = useState(initialEnd.year);
  const [endMonth, setEndMonth] = useState(initialEnd.month);

  function emit(next: {
    kind?: typeof kind;
    startYear?: string;
    startMonth?: string;
    endYear?: string;
    endMonth?: string;
  }) {
    const nextKind = next.kind ?? kind;
    const fromYear = next.startYear ?? startYear;
    const fromMonth = next.startMonth ?? startMonth;
    const toYear = next.endYear ?? endYear;
    const toMonth = next.endMonth ?? endMonth;
    if (nextKind === "year") onChange({ kind: "year", year: Number(fromYear) });
    else if (nextKind === "month")
      onChange({ kind: "month", month: monthValue(fromYear, fromMonth) });
    else
      onChange({
        kind: "month_range",
        startMonth: monthValue(fromYear, fromMonth),
        endMonth: monthValue(toYear, toMonth),
      });
  }

  const summary = value
    ? formatCasePeriod(
        value.kind,
        value.kind === "year"
          ? `${value.year}-01-01`
          : value.kind === "month"
            ? `${value.month}-01`
            : `${value.startMonth}-01`,
        value.kind === "year"
          ? `${value.year}-12-01`
          : value.kind === "month"
            ? `${value.month}-01`
            : `${value.endMonth}-01`,
      ).replace(" – ", " - ")
    : "Selecciona un período";
  const monthSelect = (
    label: string,
    selected: string,
    change: (value: string) => void,
  ) => (
    <Select value={selected} onValueChange={change}>
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {months.map((name, index) => (
          <SelectItem
            key={name}
            value={String(index + 1).padStart(2, "0")}
            className="data-[state=checked]:bg-primary-soft data-[state=checked]:text-primary data-[state=checked]:font-semibold"
          >
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  const yearSelect = (
    label: string,
    selected: string,
    change: (value: string) => void,
  ) => (
    <Select value={selected} onValueChange={change}>
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {years.map((year) => (
          <SelectItem
            key={year}
            value={year}
            className="data-[state=checked]:bg-primary-soft data-[state=checked]:text-primary data-[state=checked]:font-semibold"
          >
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-2">
      <label htmlFor="case-period" className="block text-sm font-semibold">
        Período
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="case-period"
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-label="Período del caso"
            className={`h-11 w-full justify-start px-3 text-left font-normal ${value ? "" : "text-muted-foreground"}`}
          >
            <CalendarDays aria-hidden="true" />
            <span className="truncate">{summary}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          className="max-h-[min(32rem,var(--radix-popover-content-available-height))] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto p-0"
        >
          <div className="border-border bg-muted/30 border-b px-4 py-3.5">
            <p className="font-semibold">Período del caso</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Selecciona año, mes o un rango de meses.
            </p>
          </div>
          <div className="space-y-5 p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Forma del período</label>
              <Select
                value={kind}
                onValueChange={(next) => {
                  const nextKind = next as typeof kind;
                  setKind(nextKind);
                  emit({ kind: nextKind });
                }}
              >
                <SelectTrigger
                  aria-label="Forma del período"
                  className="h-10 w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="year"
                    className="data-[state=checked]:bg-primary-soft data-[state=checked]:text-primary data-[state=checked]:font-semibold"
                  >
                    Año
                  </SelectItem>
                  <SelectItem
                    value="month"
                    className="data-[state=checked]:bg-primary-soft data-[state=checked]:text-primary data-[state=checked]:font-semibold"
                  >
                    Mes
                  </SelectItem>
                  <SelectItem
                    value="month_range"
                    className="data-[state=checked]:bg-primary-soft data-[state=checked]:text-primary data-[state=checked]:font-semibold"
                  >
                    Rango de meses
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {kind === "year" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Año</label>
                {yearSelect("Año", startYear, (next) => {
                  setStartYear(next);
                  emit({ startYear: next });
                })}
              </div>
            ) : kind === "month" ? (
              <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
                <div className="min-w-0 space-y-2">
                  <label className="text-sm font-medium">Mes</label>
                  {monthSelect("Mes", startMonth, (next) => {
                    setStartMonth(next);
                    emit({ startMonth: next });
                  })}
                </div>
                <div className="min-w-0 space-y-2">
                  <label className="text-sm font-medium">Año</label>
                  {yearSelect("Año", startYear, (next) => {
                    setStartYear(next);
                    emit({ startYear: next });
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <PeriodEndpoint
                  title="Desde"
                  month={monthSelect("Mes inicial", startMonth, (next) => {
                    setStartMonth(next);
                    emit({ startMonth: next });
                  })}
                  year={yearSelect("Año inicial", startYear, (next) => {
                    setStartYear(next);
                    emit({ startYear: next });
                  })}
                />
                <PeriodEndpoint
                  title="Hasta"
                  month={monthSelect("Mes final", endMonth, (next) => {
                    setEndMonth(next);
                    emit({ endMonth: next });
                  })}
                  year={yearSelect("Año final", endYear, (next) => {
                    setEndYear(next);
                    emit({ endYear: next });
                  })}
                />
              </div>
            )}
          </div>
          <div className="border-border bg-muted/20 flex items-center justify-between gap-3 border-t px-4 py-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!value}
              onClick={() => onChange(null)}
            >
              <X aria-hidden="true" />
              Limpiar período
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (!value) emit({});
                setOpen(false);
              }}
            >
              Listo
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Opcional. No se registran días específicos.
        </p>
      )}
    </div>
  );
}

function PeriodEndpoint({
  title,
  month,
  year,
}: {
  title: string;
  month: React.ReactNode;
  year: React.ReactNode;
}) {
  return (
    <div className="rounded-control border-border bg-background border p-3">
      <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
        {title}
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        {month}
        {year}
      </div>
    </div>
  );
}
