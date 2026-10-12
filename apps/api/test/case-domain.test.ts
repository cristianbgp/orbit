import { describe, expect, test } from "vitest";

import {
  CASE_ENTITY_OPTIONS,
  CASE_STAGE_OPTIONS,
  CASE_SUBTYPE_OPTIONS,
  CASE_TAX_OPTIONS,
} from "../src/cases/case-catalog";
import {
  CaseDomainError,
  normalizeCasePeriod,
  validateCaseClassification,
  validateCaseMoney,
  validateCaseStatusResult,
} from "../src/cases/case-domain";

describe("case catalogs", () => {
  test("exposes only the approved fixed entity and tax options", () => {
    expect(
      CASE_ENTITY_OPTIONS.map(({ value, label }) => [value, label]),
    ).toEqual([
      ["tax_court", "Tribunal Fiscal"],
      ["sunat", "SUNAT"],
      ["mef", "MEF"],
      ["municipality", "Municipalidad"],
      ["sat", "SAT"],
      ["minem", "MINEM"],
      ["judiciary", "Poder Judicial"],
    ]);
    expect(CASE_TAX_OPTIONS.map(({ value, label }) => [value, label])).toEqual([
      ["IGV", "IGV"],
      ["IR", "Impuesto a la Renta"],
      ["IR_ND", "Impuesto a la Renta de No Domiciliados"],
      ["ITAN", "Impuesto Temporal a los Activos Netos"],
      ["OTR", "Otros"],
      ["PREDIAL", "Impuesto Predial"],
    ]);
  });

  test("keeps subtypes and procedural stages scoped to their type", () => {
    expect(
      CASE_SUBTYPE_OPTIONS.filter((option) => option.type === "constitutional"),
    ).toEqual([{ type: "constitutional", value: "amparo", label: "Amparo" }]);
    expect(
      CASE_STAGE_OPTIONS.filter((option) => option.type === "constitutional"),
    ).toEqual([
      {
        type: "constitutional",
        value: "constitutional_first_instance",
        label: "Primera Instancia",
      },
    ]);
    expect(CASE_STAGE_OPTIONS).toHaveLength(15);
  });
});

describe("case classification", () => {
  test("accepts a subtype and stage belonging to the selected type", () => {
    expect(
      validateCaseClassification({
        type: "judicial",
        subtype: "dca_sunat",
        stage: "judicial_second_instance",
      }),
    ).toEqual({
      type: "judicial",
      subtype: "dca_sunat",
      stage: "judicial_second_instance",
    });
  });

  test("rejects a subtype or stage from another type", () => {
    expect(() =>
      validateCaseClassification({
        type: "administrative",
        subtype: "dca",
        stage: "administrative_claim",
      }),
    ).toThrowError(
      new CaseDomainError(
        "INVALID_SUBTYPE",
        "El subtipo no corresponde al tipo de caso.",
      ),
    );

    expect(() =>
      validateCaseClassification({
        type: "judicial",
        subtype: null,
        stage: "administrative_claim",
      }),
    ).toThrowError(
      new CaseDomainError(
        "INVALID_STAGE",
        "La etapa no corresponde al tipo de caso.",
      ),
    );
  });
});

describe("case period", () => {
  test("normalizes year, month, and cross-year ranges to first-of-month dates", () => {
    expect(normalizeCasePeriod({ kind: "year", year: 2024 })).toEqual({
      periodKind: "year",
      periodStart: "2024-01-01",
      periodEnd: "2024-12-01",
    });
    expect(normalizeCasePeriod({ kind: "month", month: "2024-03" })).toEqual({
      periodKind: "month",
      periodStart: "2024-03-01",
      periodEnd: "2024-03-01",
    });
    expect(
      normalizeCasePeriod({
        kind: "month_range",
        startMonth: "2023-11",
        endMonth: "2024-02",
      }),
    ).toEqual({
      periodKind: "month_range",
      periodStart: "2023-11-01",
      periodEnd: "2024-02-01",
    });
  });

  test("rejects incomplete and reversed periods", () => {
    expect(() =>
      normalizeCasePeriod({
        kind: "month_range",
        startMonth: "2024-03",
        endMonth: "2024-02",
      }),
    ).toThrowError(
      new CaseDomainError("INVALID_PERIOD", "Revisa el período del caso."),
    );
  });
});

describe("case money and outcome", () => {
  test("requires amount and currency together and keeps the decimal exact", () => {
    expect(
      validateCaseMoney({ amount: "15500000.50", currency: "PEN" }),
    ).toEqual({
      amount: "15500000.50",
      currency: "PEN",
    });
    expect(() =>
      validateCaseMoney({ amount: "100", currency: null }),
    ).toThrowError(
      new CaseDomainError(
        "INVALID_MONEY",
        "El importe y la moneda deben completarse juntos.",
      ),
    );
  });

  test("requires a result only after the case is concluded", () => {
    expect(
      validateCaseStatusResult({ status: "in_progress", result: null }),
    ).toEqual({
      status: "in_progress",
      result: null,
    });
    expect(
      validateCaseStatusResult({ status: "concluded", result: "founded" }),
    ).toEqual({
      status: "concluded",
      result: "founded",
    });
    expect(() =>
      validateCaseStatusResult({ status: "in_progress", result: "founded" }),
    ).toThrowError(
      new CaseDomainError(
        "INVALID_RESULT",
        "Un caso en trámite no puede tener resultado.",
      ),
    );
    expect(() =>
      validateCaseStatusResult({ status: "concluded", result: null }),
    ).toThrowError(
      new CaseDomainError(
        "INVALID_RESULT",
        "Selecciona el resultado del caso concluido.",
      ),
    );
  });
});
