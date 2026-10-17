CREATE TYPE "public"."case_action_status" AS ENUM('pending', 'completed');--> statement-breakpoint
CREATE TABLE "case_action" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"case_id" text NOT NULL,
	"description" text NOT NULL,
	"assignee_user_id" text,
	"assignee_name_snapshot" text,
	"status" "case_action_status" DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by_user_id" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_by_user_id" text
);
--> statement-breakpoint
ALTER TABLE "case_action" ADD CONSTRAINT "case_action_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_action" ADD CONSTRAINT "case_action_case_id_legal_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."legal_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_action" ADD CONSTRAINT "case_action_assignee_user_id_user_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_action" ADD CONSTRAINT "case_action_completed_by_user_id_user_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_action" ADD CONSTRAINT "case_action_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_action" ADD CONSTRAINT "case_action_archived_by_user_id_user_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_action_case_lifecycle_created_idx" ON "case_action" USING btree ("organization_id","case_id","archived_at","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "case_action_assignee_lifecycle_created_idx" ON "case_action" USING btree ("organization_id","assignee_user_id","archived_at","status","created_at" DESC NULLS LAST);