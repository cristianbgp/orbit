CREATE TABLE "feature_flag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"organization_id" text,
	"enabled" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feature_flag" ADD CONSTRAINT "feature_flag_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feature_flag_global_key_unique" ON "feature_flag" USING btree ("key") WHERE "feature_flag"."organization_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "feature_flag_organization_key_unique" ON "feature_flag" USING btree ("key","organization_id") WHERE "feature_flag"."organization_id" IS NOT NULL;