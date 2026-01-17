/*
  Warnings:

  - A unique constraint covering the columns `[webhook_token]` on the table `application_definitions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "application_definitions" ADD COLUMN     "schedule_cron" TEXT,
ADD COLUMN     "webhook_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "application_definitions_webhook_token_key" ON "application_definitions"("webhook_token");
