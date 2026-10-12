CREATE TYPE "public"."case_event_type" AS ENUM('oral_argument');--> statement-breakpoint
CREATE TABLE "case_event" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"case_id" text NOT NULL,
	"title" text NOT NULL,
	"type" "case_event_type" NOT NULL,
	"date" date NOT NULL,
	"description" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_event" ADD CONSTRAINT "case_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_event" ADD CONSTRAINT "case_event_case_id_legal_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."legal_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_event" ADD CONSTRAINT "case_event_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_event_organization_case_date_idx" ON "case_event" USING btree ("organization_id","case_id","date","id");--> statement-breakpoint
CREATE INDEX "case_event_organization_date_type_idx" ON "case_event" USING btree ("organization_id","date","type");