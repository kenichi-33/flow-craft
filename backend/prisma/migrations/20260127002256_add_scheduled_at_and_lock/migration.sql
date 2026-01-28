-- AlterTable
ALTER TABLE "workflow_tasks" ADD COLUMN     "scheduled_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "cron_schedule_locks" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "locked_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cron_schedule_locks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cron_schedule_locks_key_locked_at_key" ON "cron_schedule_locks"("key", "locked_at");
