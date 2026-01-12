/*
  Warnings:

  - You are about to drop the `approval_tasks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `service_task_histories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `service_tasks` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "approval_tasks" DROP CONSTRAINT "approval_tasks_application_id_fkey";

-- DropForeignKey
ALTER TABLE "service_task_histories" DROP CONSTRAINT "service_task_histories_application_id_fkey";

-- DropForeignKey
ALTER TABLE "service_task_histories" DROP CONSTRAINT "service_task_histories_service_task_id_fkey";

-- DropForeignKey
ALTER TABLE "service_tasks" DROP CONSTRAINT "service_tasks_application_id_fkey";

-- DropTable
DROP TABLE "approval_tasks";

-- DropTable
DROP TABLE "service_task_histories";

-- DropTable
DROP TABLE "service_tasks";
