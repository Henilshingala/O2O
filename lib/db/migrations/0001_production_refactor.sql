-- Schema additions for O2O production refactor
-- Apply with: pnpm --filter @workspace/db push (or run against PostgreSQL)

CREATE TABLE IF NOT EXISTS "password_reset_otps" (
  "email" text PRIMARY KEY NOT NULL,
  "otp_hash" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "verified_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "token_hash" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'text' NOT NULL;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "reply_to_id" text;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "edited_at" timestamp;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;
