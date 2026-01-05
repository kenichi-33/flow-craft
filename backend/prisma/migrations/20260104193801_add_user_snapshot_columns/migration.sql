-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskStatus" ADD VALUE 'FAILED';
ALTER TYPE "TaskStatus" ADD VALUE 'CANCELED';

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "applicant_info" JSONB,
ADD COLUMN     "application_number" SERIAL NOT NULL,
ADD COLUMN     "flow_edges" JSONB,
ADD COLUMN     "flow_nodes" JSONB,
ADD COLUMN     "form_schema" JSONB;

-- AlterTable
ALTER TABLE "approval_histories" ADD COLUMN     "actor_info" JSONB;

-- AlterTable
ALTER TABLE "approval_tasks" ADD COLUMN     "assigned_to_display" TEXT,
ADD COLUMN     "assigned_to_info" JSONB,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "service_tasks" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "error" TEXT,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_task_histories" (
    "id" TEXT NOT NULL,
    "service_task_id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_task_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "member_type" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_members_team_id_member_type_member_id_key" ON "team_members"("team_id", "member_type", "member_id");

-- AddForeignKey
ALTER TABLE "service_tasks" ADD CONSTRAINT "service_tasks_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_task_histories" ADD CONSTRAINT "service_task_histories_service_task_id_fkey" FOREIGN KEY ("service_task_id") REFERENCES "service_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_task_histories" ADD CONSTRAINT "service_task_histories_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
