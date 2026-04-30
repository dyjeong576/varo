ALTER TABLE "headline_articles"
ADD COLUMN "category" TEXT NOT NULL DEFAULT 'politics';

UPDATE "headline_articles"
SET "category" = 'economy'
WHERE "publisher_key" LIKE '%-economy';

CREATE INDEX "headline_articles_date_key_category_publisher_key_idx" ON "headline_articles"("date_key", "category", "publisher_key");
