ALTER TYPE "public"."project_status" ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE "public"."project_status" ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TABLE "project" ADD COLUMN "archived_at" timestamp;
CREATE INDEX "project_organization_archived_legal_deadline_idx" ON "project" USING btree ("organization_id", "archived_at", "legal_deadline");
