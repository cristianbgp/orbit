ALTER TABLE "project" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "status" SET DEFAULT 'draft'::text;--> statement-breakpoint
UPDATE "project"
SET
  "status" = 'active',
  "archived_at" = COALESCE("archived_at", now())
WHERE "status" = 'cancelled';--> statement-breakpoint
DROP TYPE "public"."project_status";--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'active', 'completed');--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."project_status";--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "status" SET DATA TYPE "public"."project_status" USING "status"::"public"."project_status";
