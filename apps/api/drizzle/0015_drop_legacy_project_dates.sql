DROP TRIGGER "project_period_compat_before_write" ON "project";--> statement-breakpoint
DROP TRIGGER "project_legal_event_compat_after_write" ON "project";--> statement-breakpoint
DROP FUNCTION public.orbit_sync_project_period_compat();--> statement-breakpoint
DROP FUNCTION public.orbit_sync_project_legal_event_compat();--> statement-breakpoint
DROP INDEX "project_organization_legal_deadline_idx";--> statement-breakpoint
DROP INDEX "project_organization_archived_legal_deadline_idx";--> statement-breakpoint
ALTER TABLE "project" DROP COLUMN "internal_deadline";--> statement-breakpoint
ALTER TABLE "project" DROP COLUMN "legal_deadline";
