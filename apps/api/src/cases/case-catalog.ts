import type {
  CaseEntity,
  CaseStage,
  CaseSubtype,
  CaseTax,
  CaseType,
} from "./case-types";

type Option<Value extends string> = { value: Value; label: string };
type TypedOption<Value extends string> = Option<Value> & { type: CaseType };

export const CASE_TYPE_OPTIONS = [
  { value: "administrative", label: "Administrativo" },
  { value: "judicial", label: "Judicial" },
  { value: "constitutional", label: "Constitucional" },
  { value: "other", label: "Otros" },
] as const satisfies readonly Option<CaseType>[];

export const CASE_SUBTYPE_OPTIONS = [
  {
    type: "administrative",
    value: "administrative_tax_litigation",
    label: "Contencioso Tributario",
  },
  { type: "administrative", value: "refund", label: "Devolución" },
  { type: "administrative", value: "audit", label: "Fiscalización" },
  { type: "administrative", value: "non_contentious", label: "No contencioso" },
  { type: "administrative", value: "limitation", label: "Prescripción" },
  {
    type: "judicial",
    value: "precautionary_notebook",
    label: "Cuaderno Cautelar",
  },
  {
    type: "judicial",
    value: "appeal_notebook",
    label: "Cuaderno de Apelación",
  },
  { type: "judicial", value: "dca", label: "DCA" },
  { type: "judicial", value: "dca_sunat", label: "DCA - Sunat" },
  {
    type: "judicial",
    value: "cassation_complaint",
    label: "Queja de Casación",
  },
  { type: "constitutional", value: "amparo", label: "Amparo" },
  { type: "other", value: "written_submission", label: "Escrito" },
  {
    type: "other",
    value: "special_installment_dl_1634",
    label: "Fraccionamiento Especial (DL 1634)",
  },
  { type: "other", value: "official_letter", label: "Oficio" },
  { type: "other", value: "petition", label: "Petición" },
] as const satisfies readonly TypedOption<CaseSubtype>[];

export const CASE_STAGE_OPTIONS = [
  {
    type: "administrative",
    value: "administrative_appeal",
    label: "Apelación",
  },
  {
    type: "administrative",
    value: "administrative_compliance",
    label: "Cumplimiento",
  },
  {
    type: "administrative",
    value: "administrative_refund",
    label: "Devolución",
  },
  {
    type: "administrative",
    value: "administrative_audit",
    label: "Fiscalización",
  },
  {
    type: "administrative",
    value: "administrative_installment",
    label: "Fraccionamiento",
  },
  {
    type: "administrative",
    value: "administrative_limitation",
    label: "Prescripción",
  },
  {
    type: "administrative",
    value: "administrative_claim",
    label: "Reclamación",
  },
  {
    type: "administrative",
    value: "administrative_review_appeal",
    label: "Recurso de Revisión",
  },
  {
    type: "administrative",
    value: "administrative_non_contentious_request",
    label: "Solicitud no contenciosa",
  },
  {
    type: "administrative",
    value: "administrative_minem_verification",
    label: "Verificación MINEM",
  },
  { type: "judicial", value: "judicial_cassation", label: "Casación" },
  { type: "judicial", value: "judicial_enforcement", label: "Ejecución" },
  {
    type: "judicial",
    value: "judicial_first_instance",
    label: "Primera Instancia",
  },
  {
    type: "judicial",
    value: "judicial_second_instance",
    label: "Segunda Instancia",
  },
  {
    type: "constitutional",
    value: "constitutional_first_instance",
    label: "Primera Instancia",
  },
] as const satisfies readonly TypedOption<CaseStage>[];

export const CASE_ENTITY_OPTIONS = [
  { value: "tax_court", label: "Tribunal Fiscal" },
  { value: "sunat", label: "SUNAT" },
  { value: "mef", label: "MEF" },
  { value: "municipality", label: "Municipalidad" },
  { value: "sat", label: "SAT" },
  { value: "minem", label: "MINEM" },
  { value: "judiciary", label: "Poder Judicial" },
] as const satisfies readonly Option<CaseEntity>[];

export const CASE_TAX_OPTIONS = [
  { value: "IGV", label: "IGV" },
  { value: "IR", label: "Impuesto a la Renta" },
  { value: "IR_ND", label: "Impuesto a la Renta de No Domiciliados" },
  { value: "ITAN", label: "Impuesto Temporal a los Activos Netos" },
  { value: "OTR", label: "Otros" },
  { value: "PREDIAL", label: "Impuesto Predial" },
] as const satisfies readonly Option<CaseTax>[];

export const CASE_CURRENCY_OPTIONS = [
  { value: "PEN", label: "Sol peruano" },
  { value: "USD", label: "Dólar estadounidense" },
] as const;

export const CASE_STATUS_OPTIONS = [
  { value: "in_progress", label: "En trámite" },
  { value: "concluded", label: "Concluido" },
] as const;

export const CASE_RESULT_OPTIONS = [
  { value: "founded", label: "Fundada" },
  { value: "unfounded", label: "Infundada" },
  { value: "inadmissible", label: "Improcedente" },
] as const;
