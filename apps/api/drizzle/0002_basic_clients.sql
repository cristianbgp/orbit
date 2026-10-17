CREATE TYPE "public"."client_type" AS ENUM('person', 'company');--> statement-breakpoint
CREATE TABLE "client" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"type" "client_type" NOT NULL,
	"name" text NOT NULL,
	"document_type" text,
	"document_number" text,
	"email" text,
	"phone" text,
	"address" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_organization_id_idx" ON "client" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "client_organization_name_idx" ON "client" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "client_organization_document_idx" ON "client" USING btree ("organization_id","document_number");