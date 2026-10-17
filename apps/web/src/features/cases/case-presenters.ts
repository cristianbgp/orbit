const labels = {
  type: {
    administrative: "Administrativo",
    judicial: "Judicial",
    constitutional: "Constitucional",
    other: "Otros",
  },
  subtype: {
    administrative_tax_litigation: "Contencioso Tributario",
    refund: "Devolución",
    audit: "Fiscalización",
    non_contentious: "No contencioso",
    limitation: "Prescripción",
    precautionary_notebook: "Cuaderno Cautelar",
    appeal_notebook: "Cuaderno de Apelación",
    dca: "DCA",
    dca_sunat: "DCA - Sunat",
    cassation_complaint: "Queja de Casación",
    amparo: "Amparo",
    written_submission: "Escrito",
    special_installment_dl_1634: "Fraccionamiento Especial (DL 1634)",
    official_letter: "Oficio",
    petition: "Petición",
  },
  stage: {
    administrative_appeal: "Apelación",
    administrative_compliance: "Cumplimiento",
    administrative_refund: "Devolución",
    administrative_audit: "Fiscalización",
    administrative_installment: "Fraccionamiento",
    administrative_limitation: "Prescripción",
    administrative_claim: "Reclamación",
    administrative_review_appeal: "Recurso de Revisión",
    administrative_non_contentious_request: "Solicitud no contenciosa",
    administrative_minem_verification: "Verificación MINEM",
    judicial_cassation: "Casación",
    judicial_enforcement: "Ejecución",
    judicial_first_instance: "Primera Instancia",
    judicial_second_instance: "Segunda Instancia",
    constitutional_first_instance: "Primera Instancia",
  },
  entity: {
    tax_court: "Tribunal Fiscal",
    sunat: "SUNAT",
    mef: "MEF",
    municipality: "Municipalidad",
    sat: "SAT",
    minem: "MINEM",
    judiciary: "Poder Judicial",
  },
  tax: {
    IGV: "IGV",
    IR: "Impuesto a la Renta",
    IR_ND: "Impuesto a la Renta de No Domiciliados",
    ITAN: "Impuesto Temporal a los Activos Netos",
    OTR: "Otros",
    PREDIAL: "Impuesto Predial",
  },
  status: { in_progress: "En trámite", concluded: "Concluido" },
  result: {
    founded: "Fundada",
    unfounded: "Infundada",
    inadmissible: "Improcedente",
  },
  claimantType: {
    client: "Cliente",
    sunat: "SUNAT",
  },
} as const;

export function getCaseLabel(
  group: keyof typeof labels,
  value: string | null | undefined,
) {
  if (!value) return "Sin definir";
  return (labels[group] as Record<string, string>)[value] ?? value;
}

export function formatCaseClaimant(
  claimantType: string | null,
  clientName: string,
) {
  if (!claimantType) return "Sin definir";
  return claimantType === "sunat" ? "SUNAT" : `Cliente: ${clientName}`;
}

function monthLabel(value: string, style: "long" | "short") {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PE", {
    month: style,
    year: "numeric",
    timeZone: "UTC",
  })
    .format(new Date(Date.UTC(year!, month! - 1, 1)))
    .replace(" de ", " ")
    .replace(".", "");
}

export function formatCasePeriod(
  kind: string | null,
  start: string | null,
  end: string | null,
) {
  if (!kind || !start || !end) return "Sin período";
  if (kind === "year") return start.slice(0, 4);
  if (kind === "month") {
    const label = monthLabel(start, "long");
    const [month, year] = label.split(" ");
    return `${month} de ${year}`;
  }
  return `${monthLabel(start, "short")} – ${monthLabel(end, "short")}`;
}

export function formatCaseAmount(
  amount: string | null,
  currency: string | null,
) {
  if (!amount || !currency) return "Sin importe";
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}
