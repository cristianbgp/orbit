ALTER TYPE "public"."case_responsibility" ADD VALUE 'follower';--> statement-breakpoint
DROP INDEX "case_assignment_active_user_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "case_assignment_active_user_responsibility_unique" ON "case_assignment" USING btree ("case_id","user_id","responsibility") WHERE "case_assignment"."ended_at" is null;