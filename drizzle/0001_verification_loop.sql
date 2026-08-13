ALTER TABLE "actions" ADD COLUMN "prompt_id" uuid;--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN "scheduled_for" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN "rate_before" numeric(6, 4);--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN "rate_after" numeric(6, 4);--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "actions_prompt_id_idx" ON "actions" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX "verifications_scheduled_for_idx" ON "verifications" USING btree ("scheduled_for");