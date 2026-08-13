ALTER TABLE "digests" ADD COLUMN "alert_immediately" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "digests" ADD COLUMN "drop_threshold" integer DEFAULT 10 NOT NULL;