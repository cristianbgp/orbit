export type CaseType =
  "administrative" | "judicial" | "constitutional" | "other";

export type CaseSubtype =
  | "administrative_tax_litigation"
  | "refund"
  | "audit"
  | "non_contentious"
  | "limitation"
  | "precautionary_notebook"
  | "appeal_notebook"
  | "dca"
  | "dca_sunat"
  | "cassation_complaint"
  | "amparo"
  | "written_submission"
  | "special_installment_dl_1634"
  | "official_letter"
  | "petition";

export type CaseStage =
  | "administrative_appeal"
  | "administrative_compliance"
  | "administrative_refund"
  | "administrative_audit"
  | "administrative_installment"
  | "administrative_limitation"
  | "administrative_claim"
  | "administrative_review_appeal"
  | "administrative_non_contentious_request"
  | "administrative_minem_verification"
  | "judicial_cassation"
  | "judicial_enforcement"
  | "judicial_first_instance"
  | "judicial_second_instance"
  | "constitutional_first_instance";

export type CaseEntity =
  | "tax_court"
  | "sunat"
  | "mef"
  | "municipality"
  | "sat"
  | "minem"
  | "judiciary";

export type CaseTax = "IGV" | "IR" | "IR_ND" | "ITAN" | "OTR" | "PREDIAL";
export type CaseCurrency = "PEN" | "USD";
export type CaseClaimantType = "client" | "sunat";
export type CaseStatus = "in_progress" | "concluded";
export type CaseResult = "founded" | "unfounded" | "inadmissible";
export type CasePeriodKind = "year" | "month" | "month_range";
