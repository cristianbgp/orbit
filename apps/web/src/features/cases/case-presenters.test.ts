import { describe, expect, test } from "vitest";
import {
  formatCaseAmount,
  formatCasePeriod,
  getCaseLabel,
} from "./case-presenters";

describe("case presenters", () => {
  test("formats normalized periods without exposing storage dates", () => {
    expect(formatCasePeriod("year", "2000-01-01", "2000-12-01")).toBe("2000");
    expect(formatCasePeriod("month", "2024-03-01", "2024-03-01")).toBe(
      "marzo de 2024",
    );
    expect(formatCasePeriod("month_range", "2023-11-01", "2024-02-01")).toBe(
      "nov 2023 – feb 2024",
    );
  });
  test("formats exact amounts by currency and resolves Spanish labels", () => {
    expect(formatCaseAmount("15500000.00", "PEN")).toBe("S/ 15,500,000.00");
    expect(getCaseLabel("status", "in_progress")).toBe("En trámite");
    expect(getCaseLabel("result", "inadmissible")).toBe("Improcedente");
    expect(getCaseLabel("subtype", "administrative_tax_litigation")).toBe(
      "Contencioso Tributario",
    );
    expect(getCaseLabel("stage", "judicial_first_instance")).toBe(
      "Primera Instancia",
    );
    expect(getCaseLabel("entity", "tax_court")).toBe("Tribunal Fiscal");
    expect(getCaseLabel("tax", "IR_ND")).toBe(
      "Impuesto a la Renta de No Domiciliados",
    );
  });
});
