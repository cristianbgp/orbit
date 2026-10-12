CREATE TYPE "public"."project_status" AS ENUM('draft', 'active');--> statement-breakpoint
CREATE TYPE "public"."project_type" AS ENUM('appeal', 'labor_lawsuit', 'due_diligence', 'other');--> statement-breakpoint
CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"type" "project_type" NOT NULL,
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"start_date" date NOT NULL,
	"internal_deadline" date NOT NULL,
	"legal_deadline" date NOT NULL,
	"internal_reference" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_organization_id_idx" ON "project" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "project_organization_client_idx" ON "project" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "project_organization_legal_deadline_idx" ON "project" USING btree ("organization_id","legal_deadline");--> statement-breakpoint
CREATE INDEX "project_organization_name_idx" ON "project" USING btree ("organization_id","name");