CREATE TYPE "public"."project_event_type" AS ENUM('legal', 'meeting', 'other');
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "end_date" date;
--> statement-breakpoint
CREATE TABLE "project_event" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"type" "project_event_type" NOT NULL,
	"date" date NOT NULL,
	"description" text,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_event" ADD CONSTRAINT "project_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_event" ADD CONSTRAINT "project_event_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_event" ADD CONSTRAINT "project_event_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "project_event_organization_project_date_idx" ON "project_event" USING btree ("organization_id", "project_id", "date", "id");
--> statement-breakpoint
CREATE INDEX "project_event_organization_date_type_idx" ON "project_event" USING btree ("organization_id", "date", "type");
--> statement-breakpoint
UPDATE "project"
SET "end_date" = "internal_deadline"
WHERE "end_date" IS NULL;
--> statement-breakpoint
INSERT INTO "project_event" (
	"id",
	"organization_id",
	"project_id",
	"title",
	"type",
	"date",
	"created_by_user_id"
)
SELECT
	'legacy-legal:' || "id",
	"organization_id",
	"id",
	'Fecha legal',
	'legal'::"project_event_type",
	"legal_deadline",
	NULL
FROM "project"
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.orbit_sync_project_period_compat()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
	IF TG_OP = 'INSERT' THEN
		IF NEW."end_date" IS NULL THEN
			NEW."end_date" := NEW."internal_deadline";
		END IF;
	ELSIF
		NEW."internal_deadline" IS DISTINCT FROM OLD."internal_deadline"
		AND NEW."end_date" IS NOT DISTINCT FROM OLD."end_date"
	THEN
		NEW."end_date" := NEW."internal_deadline";
	END IF;
	RETURN NEW;
END;
$function$;
--> statement-breakpoint
CREATE TRIGGER "project_period_compat_before_write"
BEFORE INSERT OR UPDATE OF "internal_deadline", "end_date"
ON "project"
FOR EACH ROW
EXECUTE FUNCTION public.orbit_sync_project_period_compat();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.orbit_sync_project_legal_event_compat()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
	IF
		TG_OP = 'INSERT'
		OR NEW."legal_deadline" IS DISTINCT FROM OLD."legal_deadline"
	THEN
		INSERT INTO "project_event" (
			"id",
			"organization_id",
			"project_id",
			"title",
			"type",
			"date",
			"created_by_user_id"
		)
		VALUES (
			'legacy-legal:' || NEW."id",
			NEW."organization_id",
			NEW."id",
			'Fecha legal',
			'legal'::"project_event_type",
			NEW."legal_deadline",
			NULL
		)
		ON CONFLICT ("id") DO UPDATE SET
			"organization_id" = EXCLUDED."organization_id",
			"project_id" = EXCLUDED."project_id",
			"title" = EXCLUDED."title",
			"type" = EXCLUDED."type",
			"date" = EXCLUDED."date",
			"updated_at" = now();
	END IF;
	RETURN NEW;
END;
$function$;
--> statement-breakpoint
CREATE TRIGGER "project_legal_event_compat_after_write"
AFTER INSERT OR UPDATE OF "legal_deadline"
ON "project"
FOR EACH ROW
EXECUTE FUNCTION public.orbit_sync_project_legal_event_compat();
