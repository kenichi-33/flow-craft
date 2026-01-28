-- AlterTable
ALTER TABLE "workflow_tasks" ADD COLUMN     "reminder_due_at" TIMESTAMP(3),
ADD COLUMN     "reminder_notified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sla_due_at" TIMESTAMP(3),
ADD COLUMN     "sla_notified" BOOLEAN NOT NULL DEFAULT false;
