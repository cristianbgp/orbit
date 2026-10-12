import type {
  CaseCurrency,
  CasePeriodKind,
  CaseResult,
  CaseStage,
  CaseStatus,
  CaseSubtype,
  CaseType,
} from "./case-types";
import { CASE_STAGE_OPTIONS, CASE_SUBTYPE_OPTIONS } from "./case-catalog";

export type CaseDomainErrorCode =
  | "INVALID_SUBTYPE"
  | "INVALID_STAGE"
  | "INVALID_PERIOD"
  | "INVALID_MONEY"
  | "INVALID_RESULT";

export class CaseDomainError extends Error {
  constructor(
    readonly code: CaseDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CaseDomainError";
  }
}

export function validateCaseClassification(_input: {
  type: CaseType | null;
  subtype: CaseSubtype | null;
  stage: CaseStage | null;
}) {
  const input = _input;
  if (!input.type && (input.subtype || input.stage)) {
    throw new CaseDomainError(
      input.subtype ? "INVALID_SUBTYPE" : "INVALID_STAGE",
      input.subtype
        ? "El subtipo no corresponde al tipo de caso."
        : "La etapa no corresponde al tipo de caso.",
    );
  }
  if (
    input.subtype &&
    !CASE_SUBTYPE_OPTIONS.some(
      (option) => option.type === input.type && option.value === input.subtype,
    )
  ) {
    throw new CaseDomainError(
      "INVALID_SUBTYPE",
      "El subtipo no corresponde al tipo de caso.",
    );
  }
  if (
    input.stage &&
    !CASE_STAGE_OPTIONS.some(
      (option) => option.type === input.type && option.value === input.stage,
    )
  ) {
    throw new CaseDomainError(
      "INVALID_STAGE",
      "La etapa no corresponde al tipo de caso.",
    );
  }
  return input;
}

export type CasePeriodInput =
  | { kind: "year"; year: number }
  | { kind: "month"; month: string }
  | { kind: "month_range"; startMonth: string; endMonth: string }
  | null;

export function normalizeCasePeriod(_input: CasePeriodInput): {
  periodKind: CasePeriodKind | null;
  periodStart: string | null;
  periodEnd: string | null;
} {
  const invalid = () => {
    throw new CaseDomainError("INVALID_PERIOD", "Revisa el período del caso.");
  };
  if (!_input) {
    return { periodKind: null, periodStart: null, periodEnd: null };
  }
  const monthPattern = /^(\d{4})-(0[1-9]|1[0-2])$/;
  const asDate = (month: string) =>
    monthPattern.test(month) ? `${month}-01` : invalid();

  if (_input.kind === "year") {
    if (!Number.isInteger(_input.year) || _input.year < 1 || _input.year > 9999)
      invalid();
    const year = String(_input.year).padStart(4, "0");
    return {
      periodKind: "year",
      periodStart: `${year}-01-01`,
      periodEnd: `${year}-12-01`,
    };
  }
  if (_input.kind === "month") {
    const date = asDate(_input.month);
    return { periodKind: "month", periodStart: date, periodEnd: date };
  }
  const periodStart = asDate(_input.startMonth);
  const periodEnd = asDate(_input.endMonth);
  if (periodStart > periodEnd) invalid();
  return { periodKind: "month_range", periodStart, periodEnd };
}

export function validateCaseMoney(_input: {
  amount: string | null;
  currency: CaseCurrency | null;
}) {
  const amount = _input.amount?.trim() || null;
  if ((amount === null) !== (_input.currency === null)) {
    throw new CaseDomainError(
      "INVALID_MONEY",
      "El importe y la moneda deben completarse juntos.",
    );
  }
  if (amount !== null && !/^\d{1,16}(?:\.\d{1,2})?$/.test(amount)) {
    throw new CaseDomainError("INVALID_MONEY", "Revisa el importe del caso.");
  }
  return { amount, currency: _input.currency };
}

export function validateCaseStatusResult(_input: {
  status: CaseStatus;
  result: CaseResult | null;
}) {
  if (_input.status === "in_progress" && _input.result !== null) {
    throw new CaseDomainError(
      "INVALID_RESULT",
      "Un caso en trámite no puede tener resultado.",
    );
  }
  if (_input.status === "concluded" && _input.result === null) {
    throw new CaseDomainError(
      "INVALID_RESULT",
      "Selecciona el resultado del caso concluido.",
    );
  }
  return _input;
}
