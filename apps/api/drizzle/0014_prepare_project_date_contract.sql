ALTER TABLE "project" ALTER COLUMN "end_date" SET NOT NULL;
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
		IF NEW."internal_deadline" IS NULL THEN
			NEW."internal_deadline" := NEW."end_date";
		END IF;
		IF NEW."legal_deadline" IS NULL THEN
			NEW."legal_deadline" := NEW."end_date";
		END IF;
	ELSIF
		NEW."internal_deadline" IS DISTINCT FROM OLD."internal_deadline"
		AND NEW."end_date" IS NOT DISTINCT FROM OLD."end_date"
	THEN
		NEW."end_date" := NEW."internal_deadline";
	ELSIF
		NEW."end_date" IS DISTINCT FROM OLD."end_date"
		AND NEW."internal_deadline" IS NOT DISTINCT FROM OLD."internal_deadline"
	THEN
		NEW."internal_deadline" := NEW."end_date";
	END IF;
	RETURN NEW;
END;
$function$;
