ALTER TABLE "headline_scrape_runs"
ADD COLUMN "category" TEXT NOT NULL DEFAULT 'politics';

ALTER TABLE "headline_analyses"
ADD COLUMN "category" TEXT NOT NULL DEFAULT 'politics';

DROP INDEX "headline_scrape_runs_date_key_started_at_idx";
CREATE INDEX "headline_scrape_runs_date_key_category_started_at_idx" ON "headline_scrape_runs"("date_key", "category", "started_at");

DROP INDEX "headline_analyses_date_key_key";
CREATE UNIQUE INDEX "headline_analyses_date_key_category_key" ON "headline_analyses"("date_key", "category");
