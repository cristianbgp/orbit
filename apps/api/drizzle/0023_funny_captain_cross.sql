CREATE TYPE "public"."case_assignment_end_reason" AS ENUM('case_unassigned', 'organization_removed');--> statement-breakpoint
CREATE TYPE "public"."case_currency" AS ENUM('PEN', 'USD');--> statement-breakpoint
CREATE TYPE "public"."case_period_kind" AS ENUM('year', 'month', 'month_range');--> statement-breakpoint
CREATE TYPE "public"."case_responsibility" AS ENUM('member');--> statement-breakpoint
CREATE TYPE "public"."case_result" AS ENUM('founded', 'unfounded', 'inadmissible');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('in_progress', 'concluded');--> statement-breakpoint
CREATE TYPE "public"."case_type" AS ENUM('administrative', 'judicial', 'constitutional', 'other');--> statement-breakpoint
CREATE TABLE "case_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"case_id" text NOT NULL,
	"type" text NOT NULL,
	"actor_user_id" text,
	"actor_name_snapshot" text NOT NULL,
	"subject_user_id" text,
	"subject_name_snapshot" text,
	"details" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"case_id" text NOT NULL,
	"user_id" text,
	"user_name_snapshot" text NOT NULL,
	"user_email_snapshot" text NOT NULL,
	"responsibility" "case_responsibility" DEFAULT 'member' NOT NULL,
	"assigned_by_user_id" text,
	"assigned_by_name_snapshot" text NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"ended_by_user_id" text,
	"ended_by_name_snapshot" text,
	"end_reason" "case_assignment_end_reason"
);
--> statement-breakpoint
CREATE TABLE "legal_case" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"client_id" text NOT NULL,
	"identification" text NOT NULL,
	"type" "case_type",
	"subtype" text,
	"stage" text,
	"entity" text,
	"docket_number" text,
	"tax" text,
	"period_kind" "case_period_kind",
	"period_start" date,
	"period_end" date,
	"amount" numeric(18, 2),
	"currency" "case_currency",
	"claimant" text,
	"disputed_matter" text,
	"challenged_resolution" text,
	"status" "case_status" DEFAULT 'in_progress' NOT NULL,
	"result" "case_result",
	"archived_at" timestamp with time zone,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_case_status_result_check" CHECK (("legal_case"."status" = 'in_progress' and "legal_case"."result" is null) or ("legal_case"."status" = 'concluded' and "legal_case"."result" is not null)),
	CONSTRAINT "legal_case_amount_currency_check" CHECK (("legal_case"."amount" is null and "legal_case"."currency" is null) or ("legal_case"."amount" is not null and "legal_case"."currency" is not null)),
	CONSTRAINT "legal_case_period_check" CHECK (("legal_case"."period_kind" is null and "legal_case"."period_start" is null and "legal_case"."period_end" is null) or ("legal_case"."period_kind" is not null and "legal_case"."period_start" is not null and "legal_case"."period_end" is not null and "legal_case"."period_start" <= "legal_case"."period_end"))
);
--> statement-breakpoint
ALTER TABLE "case_activity" ADD CONSTRAINT "case_activity_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_activity" ADD CONSTRAINT "case_activity_case_id_legal_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."legal_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_activity" ADD CONSTRAINT "case_activity_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_activity" ADD CONSTRAINT "case_activity_subject_user_id_user_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_assignment" ADD CONSTRAINT "case_assignment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_assignment" ADD CONSTRAINT "case_assignment_case_id_legal_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."legal_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_assignment" ADD CONSTRAINT "case_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_assignment" ADD CONSTRAINT "case_assignment_assigned_by_user_id_user_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_assignment" ADD CONSTRAINT "case_assignment_ended_by_user_id_user_id_fk" FOREIGN KEY ("ended_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_case" ADD CONSTRAINT "legal_case_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_case" ADD CONSTRAINT "legal_case_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_case" ADD CONSTRAINT "legal_case_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_activity_case_created_idx" ON "case_activity" USING btree ("organization_id","case_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "case_activity_organization_created_idx" ON "case_activity" USING btree ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "case_assignment_active_user_unique" ON "case_assignment" USING btree ("case_id","user_id") WHERE "case_assignment"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "case_assignment_case_ended_idx" ON "case_assignment" USING btree ("organization_id","case_id","ended_at");--> statement-breakpoint
CREATE INDEX "legal_case_organization_idx" ON "legal_case" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "legal_case_organization_client_idx" ON "legal_case" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "legal_case_organization_status_idx" ON "legal_case" USING btree ("organization_id","status","archived_at");--> statement-breakpoint
CREATE INDEX "legal_case_organization_type_idx" ON "legal_case" USING btree ("organization_id","type");--> statement-breakpoint
CREATE INDEX "legal_case_organization_identification_idx" ON "legal_case" USING btree ("organization_id","identification");