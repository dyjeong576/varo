/*
  Warnings:

  - You are about to drop the column `source_country_code` on the `sources` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "notification_reads" ALTER COLUMN "read_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sources" DROP COLUMN "source_country_code";

-- AlterTable
ALTER TABLE "user_notification_preferences" ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);
