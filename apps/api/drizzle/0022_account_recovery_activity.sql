CREATE TABLE "account_recovery_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"actor_user_id" text,
	"actor_name_snapshot" text NOT NULL,
	"subject_user_id" text,
	"subject_name_snapshot" text NOT NULL,
	"subject_email_snapshot" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_recovery_activity" ADD CONSTRAINT "account_recovery_activity_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_recovery_activity" ADD CONSTRAINT "account_recovery_activity_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_recovery_activity" ADD CONSTRAINT "account_recovery_activity_subject_user_id_user_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_recovery_activity_organization_created_idx" ON "account_recovery_activity" USING btree ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "account_recovery_activity_subject_created_idx" ON "account_recovery_activity" USING btree ("subject_user_id","created_at" DESC NULLS LAST);
