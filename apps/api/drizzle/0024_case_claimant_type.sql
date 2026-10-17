CREATE TYPE "public"."case_claimant_type" AS ENUM('client', 'sunat');--> statement-breakpoint
ALTER TABLE "legal_case" ADD COLUMN "claimant_type" "case_claimant_type";--> statement-breakpoint
UPDATE "legal_case"
SET "claimant_type" = CASE
  WHEN lower(trim("claimant")) = 'sunat' THEN 'sunat'::"case_claimant_type"
  ELSE 'client'::"case_claimant_type"
END
WHERE "type" = 'judicial';--> statement-breakpoint
UPDATE "legal_case"
SET "docket_number" = NULL
WHERE "stage" IS NULL;--> statement-breakpoint
ALTER TABLE "legal_case" DROP COLUMN "claimant";--> statement-breakpoint
ALTER TABLE "legal_case" ADD CONSTRAINT "legal_case_claimant_type_check" CHECK (("type" = 'judicial' and "claimant_type" is not null) or ("type" is distinct from 'judicial' and "claimant_type" is null));--> statement-breakpoint
ALTER TABLE "legal_case" ADD CONSTRAINT "legal_case_docket_stage_check" CHECK ("stage" is not null or "docket_number" is null);
