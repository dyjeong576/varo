CREATE TABLE "users" (
  "id" UUID PRIMARY KEY,
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "display_name" VARCHAR(255),
  "auth_provider" VARCHAR(64) NOT NULL DEFAULT 'google',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "user_profiles" (
  "user_id" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "real_name" VARCHAR(255),
  "gender" VARCHAR(32),
  "age_range" VARCHAR(32),
  "country" VARCHAR(128),
  "city" VARCHAR(128),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "sessions" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider_subject" VARCHAR(255) NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "sessions_user_id_idx" ON "sessions" ("user_id");
