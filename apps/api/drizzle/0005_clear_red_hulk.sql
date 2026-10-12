CREATE TYPE "public"."project_assignment_end_reason" AS ENUM('project_unassigned', 'organization_removed');--> statement-breakpoint
CREATE TYPE "public"."project_responsibility" AS ENUM('responsible', 'member');--> statement-breakpoint
CREATE TABLE "project_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"type" text NOT NULL,
	"actor_user_id" text,
	"actor_name_snapshot" text NOT NULL,
	"subject_user_id" text,
	"subject_name_snapshot" text,
	"details" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text,
	"user_name_snapshot" text NOT NULL,
	"user_email_snapshot" text NOT NULL,
	"responsibility" "project_responsibility" NOT NULL,
	"assigned_by_user_id" text,
	"assigned_by_name_snapshot" text NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"ended_by_user_id" text,
	"ended_by_name_snapshot" text,
	"end_reason" "project_assignment_end_reason"
);
--> statement-breakpoint
ALTER TABLE "project_activity" ADD CONSTRAINT "project_activity_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_activity" ADD CONSTRAINT "project_activity_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_activity" ADD CONSTRAINT "project_activity_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_activity" ADD CONSTRAINT "project_activity_subject_user_id_user_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignment" ADD CONSTRAINT "project_assignment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignment" ADD CONSTRAINT "project_assignment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignment" ADD CONSTRAINT "project_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignment" ADD CONSTRAINT "project_assignment_assigned_by_user_id_user_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignment" ADD CONSTRAINT "project_assignment_ended_by_user_id_user_id_fk" FOREIGN KEY ("ended_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_activity_project_created_idx" ON "project_activity" USING btree ("organization_id","project_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "project_assignment_active_user_unique" ON "project_assignment" USING btree ("project_id","user_id") WHERE "project_assignment"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "project_assignment_project_responsibility_idx" ON "project_assignment" USING btree ("organization_id","project_id","responsibility");--> statement-breakpoint
CREATE INDEX "project_assignment_project_ended_idx" ON "project_assignment" USING btree ("organization_id","project_id","ended_at");