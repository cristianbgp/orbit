CREATE TABLE "case_update" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"case_id" text NOT NULL,
	"date" date NOT NULL,
	"description" text NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_by_user_id" text
);
--> statement-breakpoint
ALTER TABLE "case_update" ADD CONSTRAINT "case_update_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_update" ADD CONSTRAINT "case_update_case_id_legal_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."legal_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_update" ADD CONSTRAINT "case_update_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_update" ADD CONSTRAINT "case_update_archived_by_user_id_user_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_update_case_lifecycle_date_idx" ON "case_update" USING btree ("organization_id","case_id","archived_at","date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "case_update_case_created_idx" ON "case_update" USING btree ("organization_id","case_id","created_at" DESC NULLS LAST);