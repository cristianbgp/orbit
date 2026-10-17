CREATE TYPE "public"."project_task_status" AS ENUM('pending', 'in_progress', 'blocked', 'completed');--> statement-breakpoint
CREATE TYPE "public"."task_assignment_end_reason" AS ENUM('task_unassigned', 'project_unassigned', 'organization_removed');--> statement-breakpoint
CREATE TABLE "project_task" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"stage_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "project_task_status" DEFAULT 'pending' NOT NULL,
	"internal_due_date" date,
	"position" integer NOT NULL,
	"archived_at" timestamp,
	"archived_by_user_id" text,
	"archived_by_name_snapshot" text,
	"created_by_user_id" text,
	"created_by_name_snapshot" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"task_id" text NOT NULL,
	"user_id" text,
	"user_name_snapshot" text NOT NULL,
	"user_email_snapshot" text NOT NULL,
	"assigned_by_user_id" text,
	"assigned_by_name_snapshot" text NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"ended_by_user_id" text,
	"ended_by_name_snapshot" text,
	"end_reason" "task_assignment_end_reason"
);
--> statement-breakpoint
ALTER TABLE "project_task" ADD CONSTRAINT "project_task_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_task" ADD CONSTRAINT "project_task_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_task" ADD CONSTRAINT "project_task_stage_id_project_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."project_stage"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_task" ADD CONSTRAINT "project_task_archived_by_user_id_user_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_task" ADD CONSTRAINT "project_task_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignment" ADD CONSTRAINT "task_assignment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignment" ADD CONSTRAINT "task_assignment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignment" ADD CONSTRAINT "task_assignment_task_id_project_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."project_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignment" ADD CONSTRAINT "task_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignment" ADD CONSTRAINT "task_assignment_assigned_by_user_id_user_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignment" ADD CONSTRAINT "task_assignment_ended_by_user_id_user_id_fk" FOREIGN KEY ("ended_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_task_active_order_idx" ON "project_task" USING btree ("organization_id","project_id","stage_id","position") WHERE "project_task"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "project_task_archived_order_idx" ON "project_task" USING btree ("organization_id","project_id","stage_id","position") WHERE "project_task"."archived_at" is not null;--> statement-breakpoint
CREATE INDEX "project_task_stage_reference_idx" ON "project_task" USING btree ("organization_id","project_id","stage_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_assignment_active_user_unique" ON "task_assignment" USING btree ("task_id","user_id") WHERE "task_assignment"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "task_assignment_task_active_idx" ON "task_assignment" USING btree ("organization_id","project_id","task_id","ended_at");--> statement-breakpoint
CREATE INDEX "task_assignment_task_history_idx" ON "task_assignment" USING btree ("organization_id","project_id","task_id","ended_at");
