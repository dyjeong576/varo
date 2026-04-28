ALTER TABLE "sources"
ADD COLUMN "source_provider" TEXT;

UPDATE "sources"
SET "source_provider" = CASE
  WHEN "original_url" LIKE '%n.news.naver.com%' THEN 'naver-search'
  ELSE 'tavily-search'
END
WHERE "source_provider" IS NULL;

ALTER TABLE "sources"
ALTER COLUMN "source_provider" SET NOT NULL;

ALTER TABLE "sources"
DROP CONSTRAINT IF EXISTS "sources_domain_registry_id_fkey";

DROP INDEX IF EXISTS "sources_domain_registry_id_idx";

ALTER TABLE "sources"
DROP COLUMN IF EXISTS "domain_registry_id";

DROP TABLE IF EXISTS "source_domain_registry";

CREATE INDEX "sources_source_provider_idx" ON "sources"("source_provider");
