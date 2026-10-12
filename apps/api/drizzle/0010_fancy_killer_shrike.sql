ALTER TABLE "project" ALTER COLUMN "type" SET DATA TYPE text USING 'other';--> statement-breakpoint
DROP TYPE "public"."project_type";--> statement-breakpoint
CREATE TYPE "public"."project_type" AS ENUM('written_submission', 'consultation', 'other');--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "type" SET DATA TYPE "public"."project_type" USING "type"::"public"."project_type";
