CREATE TYPE "public"."run_kind" AS ENUM('full', 'verification');--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "kind" "run_kind" DEFAULT 'full' NOT NULL;--> statement-breakpoint
CREATE INDEX "runs_brand_id_kind_idx" ON "runs" USING btree ("brand_id","kind");