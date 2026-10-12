CREATE TYPE "public"."case_update_kind" AS ENUM('update', 'background');--> statement-breakpoint
ALTER TABLE "case_update" ADD COLUMN "kind" "case_update_kind" DEFAULT 'update' NOT NULL;--> statement-breakpoint
CREATE INDEX "case_update_case_kind_date_idx" ON "case_update" USING btree ("organization_id","case_id","archived_at","kind","date" DESC NULLS LAST);